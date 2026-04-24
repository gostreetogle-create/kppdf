#!/usr/bin/env bash
set -euo pipefail

SKIP_PULL=0
ALLOW_DIRTY=0
SHOW_HELP=0
AUTO_CLEAN_GENERATED=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-pull)
      SKIP_PULL=1
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    --no-auto-clean-generated)
      AUTO_CLEAN_GENERATED=0
      shift
      ;;
    -h|--help)
      SHOW_HELP=1
      shift
      ;;
    *)
      echo "[deploy] ОШИБКА: неизвестный аргумент: $1. Используйте --help." >&2
      exit 1
      ;;
  esac
done

if [[ "${SHOW_HELP}" -eq 1 ]]; then
  cat <<'EOF'
Usage:
  sudo bash deploy/deploy.sh [--skip-pull] [--allow-dirty] [--no-auto-clean-generated]
  sudo bash deploy/deploy.sh --help

Опции:
  --skip-pull    не выполнять git pull
  --allow-dirty  разрешить деплой при незакоммиченных изменениях в репозитории
  --no-auto-clean-generated  не очищать авто-генерируемые git-артефакты (backend/dist)

Что делает:
  1. Проверяет deploy/.env и обязательные переменные
  2. Безопасно обновляет код через git pull (если не --skip-pull)
  3. Собирает backend (TypeScript) и frontend (Angular)
  4. Генерирует backend/.env из deploy/.env
  5. Настраивает/обновляет systemd-сервис backend
  6. Настраивает/обновляет nginx site + деплоит frontend-статику
  7. Проверяет health backend и доступность web
EOF
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKEND_SERVICE_FILE="/etc/systemd/system/kppdf-backend.service"
NGINX_SITE_FILE="/etc/nginx/sites-available/kppdf.conf"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/kppdf.conf"
WEB_ROOT="/var/www/kppdf"
LE_LIVE_DIR=""
SSL_FULLCHAIN=""
SSL_PRIVKEY=""

log() { echo "[deploy] $*"; }
err() { echo "[deploy] ОШИБКА: $*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || err "Команда '$1' не найдена."; }
is_dangerous_path() {
  local p="$1"
  [[ -z "${p}" || "${p}" == "/" || "${p}" == "." || "${p}" == "/root" || "${p}" == "/var" ]]
}

[[ "$(id -u)" -eq 0 ]] || err "Скрипт нужно запускать от root: sudo bash deploy/deploy.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  log "Файл deploy/.env не найден — копирую из .env.example"
  cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
  log "Отредактируйте deploy/.env и запустите скрипт снова."
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

DOMAIN="${DOMAIN:-_}"
PRIMARY_DOMAIN="$(awk '{print $1}' <<<"${DOMAIN}")"
WEB_PORT="${WEB_PORT:-80}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
MONGO_DB="${MONGO_DB:-kp-app}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/${MONGO_DB}}"
MEDIA_ROOT="${MEDIA_ROOT:-${REPO_ROOT}/media}"
DADATA_TOKEN="${DADATA_TOKEN:-}"
LE_LIVE_DIR="/etc/letsencrypt/live/${PRIMARY_DOMAIN}"
SSL_FULLCHAIN="${LE_LIVE_DIR}/fullchain.pem"
SSL_PRIVKEY="${LE_LIVE_DIR}/privkey.pem"

[[ -n "${CORS_ORIGIN:-}" ]] || err "CORS_ORIGIN не задан в deploy/.env"
[[ "${CORS_ORIGIN}" != "*" ]] || err "CORS_ORIGIN='*' запрещён в production."
[[ -n "${JWT_SECRET:-}" ]] || err "JWT_SECRET не задан в deploy/.env"
[[ "${#JWT_SECRET}" -ge 32 ]] || err "JWT_SECRET слишком короткий (минимум 32 символа)."

require_cmd git
require_cmd node
require_cmd npm
require_cmd systemctl
require_cmd nginx
require_cmd curl
require_cmd rsync

log "Конфигурация:"
log "  DOMAIN       = ${DOMAIN}"
log "  WEB_PORT     = ${WEB_PORT}"
log "  BACKEND_PORT = ${BACKEND_PORT}"
log "  MONGO_URI    = ${MONGO_URI}"
log "  CORS_ORIGIN  = ${CORS_ORIGIN}"
log "  JWT_SECRET   = [set]"

if git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [[ "${AUTO_CLEAN_GENERATED}" -eq 1 ]]; then
    if [[ -d "${REPO_ROOT}/backend/dist" ]]; then
      log "Очищаю auto-generated артефакты backend/dist перед проверкой git..."
      git -C "${REPO_ROOT}" restore --source=HEAD --worktree --staged backend/dist >/dev/null 2>&1 || true
      git -C "${REPO_ROOT}" clean -fd backend/dist >/dev/null 2>&1 || true
    fi
  fi

  if [[ "${SKIP_PULL}" -eq 1 ]]; then
    log "git pull пропущен (--skip-pull)."
  else
    if [[ "${ALLOW_DIRTY}" -ne 1 ]]; then
      if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain)" ]]; then
        err "В репозитории есть незакоммиченные изменения. Чтобы защитить локальные данные, pull остановлен. Сделайте commit/stash или запустите с --allow-dirty."
      fi
    fi
    log "Обновляю код из git (безопасный ff-only)..."
    git -C "${REPO_ROOT}" fetch origin
    git -C "${REPO_ROOT}" pull --ff-only || err "Не удалось выполнить git pull --ff-only. Разрешите конфликт вручную."
    log "Код обновлён: $(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
  fi
else
  log "Не git-репозиторий — пропускаю git pull."
fi

log "Собираю backend..."
npm --prefix "${REPO_ROOT}/backend" ci
npm --prefix "${REPO_ROOT}/backend" run build

log "Собираю frontend..."
set +e
npm --prefix "${REPO_ROOT}/frontend" ci
FRONTEND_CI_EXIT=$?
set -e

if [[ "${FRONTEND_CI_EXIT}" -eq 0 ]]; then
  log "Frontend dependencies installed via npm ci."
else
  log "ПРЕДУПРЕЖДЕНИЕ: npm ci для frontend завершился ошибкой (обычно peer dependency conflict)."
  log "Пробую fallback: npm ci --legacy-peer-deps"
  npm --prefix "${REPO_ROOT}/frontend" ci --legacy-peer-deps
fi
npm --prefix "${REPO_ROOT}/frontend" run build

mkdir -p "${MEDIA_ROOT}"
if [[ "${MEDIA_ROOT}" == "${REPO_ROOT}"* ]]; then
  log "ВНИМАНИЕ: MEDIA_ROOT находится внутри репозитория (${MEDIA_ROOT}). Рекомендуется вынести его вне git-дерева."
fi

cat > "${REPO_ROOT}/backend/.env" <<EOF
NODE_ENV=production
PORT=${BACKEND_PORT}
MONGO_URI=${MONGO_URI}
CORS_ORIGIN=${CORS_ORIGIN}
JWT_SECRET=${JWT_SECRET}
DADATA_TOKEN=${DADATA_TOKEN}
MEDIA_ROOT=${MEDIA_ROOT}
EOF
chmod 600 "${REPO_ROOT}/backend/.env"

cat > "${BACKEND_SERVICE_FILE}" <<EOF
[Unit]
Description=KPPDF Backend
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
WorkingDirectory=${REPO_ROOT}/backend
ExecStart=$(command -v node) ${REPO_ROOT}/backend/dist/app.js
Restart=always
RestartSec=5
EnvironmentFile=${REPO_ROOT}/backend/.env
Environment=NODE_ENV=production
User=root

[Install]
WantedBy=multi-user.target
EOF

log "Перезапускаю backend service..."
systemctl daemon-reload
systemctl enable --now kppdf-backend
systemctl restart kppdf-backend

is_dangerous_path "${WEB_ROOT}" && err "WEB_ROOT имеет опасный путь: '${WEB_ROOT}'. Останавливаю деплой."
mkdir -p "${WEB_ROOT}"
rsync -a --delete "${REPO_ROOT}/frontend/dist/kppdf-frontend/browser/" "${WEB_ROOT}/"

if [[ -f "${SSL_FULLCHAIN}" && -f "${SSL_PRIVKEY}" ]]; then
  log "Найден TLS-сертификат (${SSL_FULLCHAIN}). Публикую HTTPS и HTTP->HTTPS redirect."
  cat > "${NGINX_SITE_FILE}" <<EOF
server {
  listen ${WEB_PORT};
  server_name ${DOMAIN};
  return 301 https://\$host\$request_uri;
}

server {
  listen 443 ssl http2;
  server_name ${DOMAIN};
  client_max_body_size 100m;

  ssl_certificate ${SSL_FULLCHAIN};
  ssl_certificate_key ${SSL_PRIVKEY};
  ssl_session_timeout 1d;
  ssl_session_cache shared:SSL:10m;
  ssl_session_tickets off;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;

  root ${WEB_ROOT};
  index index.html;
  charset utf-8;

  location ^~ /api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ^~ /media/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/media/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* ^/products/.+\.(?:png|jpg|jpeg|gif|svg|webp)$ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* ^/kp/.+\.(?:png|jpg|jpeg|gif|svg|webp)$ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* \.(?:js|mjs|css|map|woff2?|ico|png|jpg|jpeg|gif|svg|webp)$ {
    try_files \$uri =404;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    try_files \$uri =404;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
EOF
else
  log "TLS-сертификат не найден (${SSL_FULLCHAIN}). Публикую HTTP-only конфиг."
  cat > "${NGINX_SITE_FILE}" <<EOF
server {
  listen ${WEB_PORT};
  server_name ${DOMAIN};
  client_max_body_size 100m;

  root ${WEB_ROOT};
  index index.html;
  charset utf-8;

  location ^~ /api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ^~ /media/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/media/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* ^/products/.+\.(?:png|jpg|jpeg|gif|svg|webp)$ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* ^/kp/.+\.(?:png|jpg|jpeg|gif|svg|webp)$ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location ~* \.(?:js|mjs|css|map|woff2?|ico|png|jpg|jpeg|gif|svg|webp)$ {
    try_files \$uri =404;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    try_files \$uri =404;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
  }
}
EOF
fi

[[ -L "${NGINX_SITE_LINK}" ]] || ln -s "${NGINX_SITE_FILE}" "${NGINX_SITE_LINK}"
[[ -f /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}/"
HTTPS_WEB_URL="https://127.0.0.1/"

log "Жду готовности backend (${BACKEND_URL})..."
for i in $(seq 1 30); do
  if curl -fsS --connect-timeout 3 --max-time 8 "${BACKEND_URL}" >/dev/null 2>&1; then
    log "Backend готов."
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    journalctl -u kppdf-backend --no-pager -n 100 || true
    err "Backend не ответил за 60 секунд."
  fi
  sleep 2
done

log "Проверяю web (${WEB_URL})..."
if curl -fsS --connect-timeout 3 --max-time 8 "${WEB_URL}" >/dev/null 2>&1; then
  log "Web отвечает."
else
  log "ПРЕДУПРЕЖДЕНИЕ: web не ответил."
fi

if [[ -f "${SSL_FULLCHAIN}" && -f "${SSL_PRIVKEY}" ]]; then
  log "Проверяю HTTPS web (${HTTPS_WEB_URL})..."
  if curl -kfsS --connect-timeout 3 --max-time 8 "${HTTPS_WEB_URL}" >/dev/null 2>&1; then
    log "HTTPS web отвечает."
  else
    log "ПРЕДУПРЕЖДЕНИЕ: HTTPS web не ответил."
  fi
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Деплой выполнен успешно!"
log "  Web: http://<IP-сервера>:${WEB_PORT}"
if [[ -f "${SSL_FULLCHAIN}" && -f "${SSL_PRIVKEY}" ]]; then
  log "  Web (HTTPS): https://<домен>"
fi
log "  API: http://<IP-сервера>:${WEB_PORT}/api"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

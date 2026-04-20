#!/usr/bin/env bash
set -euo pipefail

# ─── Запуск: bash deploy/deploy.sh (из корня репозитория) ─────────────────────

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash deploy/deploy.sh          # полный деплой
  bash deploy/deploy.sh --help   # эта справка

Что делает:
  1. Проверяет наличие deploy/.env
  2. Обновляет код через git pull (если это git-репозиторий)
  3. Собирает Docker-образы (backend + web)
  4. Поднимает контейнеры (mongodb + backend + web)
  5. Проверяет health backend и доступность web

Требования на сервере:
  - Docker + Docker Compose v2
  - bash
  - git (опционально, для auto-pull)

Переменные окружения (deploy/.env):
  BACKEND_PORT   — порт API (default: 3000)
  WEB_PORT       — порт nginx (default: 8080)
  MONGO_DB       — имя базы MongoDB (default: kp-app)
  CORS_ORIGIN    — origin фронтенда (обязательно в production)
EOF
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

log() { echo "[deploy] $*"; }
err() { echo "[deploy] ОШИБКА: $*" >&2; exit 1; }

# ─── 1. .env ──────────────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  log "Файл deploy/.env не найден — копирую из .env.example"
  cp "${SCRIPT_DIR}/.env.example" "${ENV_FILE}"
  log "Отредактируйте deploy/.env и запустите скрипт снова."
  exit 1
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

[[ -n "${CORS_ORIGIN:-}" ]] || err "CORS_ORIGIN не задан в deploy/.env"
[[ "${CORS_ORIGIN}" != "*" ]] || err "CORS_ORIGIN='*' запрещён в production. Укажите точный origin."

log "Конфигурация:"
log "  WEB_PORT     = ${WEB_PORT:-8080}"
log "  BACKEND_PORT = ${BACKEND_PORT:-3000}"
log "  MONGO_DB     = ${MONGO_DB:-kp-app}"
log "  CORS_ORIGIN  = ${CORS_ORIGIN}"

# ─── 2. git pull ──────────────────────────────────────────────────────────────
if git -C "${REPO_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Обновляю код из git..."
  git -C "${REPO_ROOT}" fetch origin
  if ! git -C "${REPO_ROOT}" pull --ff-only; then
    log "pull --ff-only не удался. Пробую stash + pull..."
    git -C "${REPO_ROOT}" stash push -m "kp-deploy auto $(date -Iseconds 2>/dev/null || date)" -- deploy/ 2>/dev/null || true
    git -C "${REPO_ROOT}" pull --ff-only || err "Не удалось обновить репозиторий. Выполните вручную: git fetch origin && git reset --hard origin/main"
  fi
  log "Код обновлён: $(git -C "${REPO_ROOT}" rev-parse --short HEAD)"
else
  log "Не git-репозиторий — пропускаю git pull."
fi

# ─── 3. Сборка образов ────────────────────────────────────────────────────────
dc() { docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"; }

log "Собираю образы..."
dc build --no-cache backend
dc build --no-cache web

# ─── 4. Запуск контейнеров ────────────────────────────────────────────────────
log "Запускаю контейнеры..."
dc up -d --remove-orphans

# ─── 5. Health check backend ──────────────────────────────────────────────────
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT:-3000}/health"
log "Жду готовности backend (${BACKEND_URL})..."

for i in $(seq 1 30); do
  if curl -fsS --connect-timeout 3 --max-time 8 "${BACKEND_URL}" >/dev/null 2>&1; then
    log "Backend готов."
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    log "Backend не ответил за 60 сек. Последние логи:"
    dc logs backend --tail 50
    err "Деплой завершился с ошибкой."
  fi
  sleep 2
done

# ─── 6. Проверка web ──────────────────────────────────────────────────────────
WEB_URL="http://127.0.0.1:${WEB_PORT:-8080}/"
log "Проверяю nginx (${WEB_URL})..."

web_ok=0
for i in $(seq 1 15); do
  if curl -fsS --connect-timeout 3 --max-time 8 "${WEB_URL}" >/dev/null 2>&1; then
    web_ok=1
    break
  fi
  sleep 2
done

if [[ "${web_ok}" -eq 1 ]]; then
  log "Web (nginx) отвечает."
else
  log "ПРЕДУПРЕЖДЕНИЕ: nginx не ответил. Проверьте логи:"
  dc logs web --tail 30
fi

# ─── Итог ─────────────────────────────────────────────────────────────────────
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Деплой выполнен успешно!"
log "  Приложение: http://<IP-сервера>:${WEB_PORT:-8080}"
log "  API:        http://<IP-сервера>:${BACKEND_PORT:-3000}/api"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

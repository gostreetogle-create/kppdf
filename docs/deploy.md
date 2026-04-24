# Деплой (без Docker)

## Структура

```
deploy/
├── .env.example      # шаблон переменных для deploy.sh
├── deploy            # удобный wrapper: one-command запуск
└── deploy.sh         # нативный деплой: npm + systemd + nginx
```

Прод-схема:
- backend: `systemd` сервис `kppdf-backend`
- frontend: статика в `/var/www/kppdf`
- reverse proxy: `nginx` (`/api`, `/media`, `/products`, `/kp`)
- БД: локальный `mongod` на сервере

---

## Требования на сервере

- Ubuntu 22.04/24.04
- Node.js 20 + npm
- MongoDB
- nginx
- git

---

## Первый деплой

```bash
# 1) Клонировать проект
git clone <repo-url> /opt/kppdf
cd /opt/kppdf

# 2) Создать и заполнить env
cp deploy/.env.example deploy/.env
nano deploy/.env

# 3) Запустить деплой одной командой
cd deploy
./deploy
```

---

## Переменные окружения (`deploy/.env`)

| Переменная | По умолчанию | Описание |
|-----------|---------------|----------|
| `DOMAIN` | `go.tiit` | `server_name` в nginx (можно несколько доменов через пробел) |
| `WEB_PORT` | `80` | Порт nginx |
| `BACKEND_PORT` | `3000` | Порт backend |
| `MONGO_DB` | `kp-app` | Имя базы |
| `MONGO_URI` | — | Полный URI MongoDB (если пусто, собирается из `MONGO_DB`) |
| `CORS_ORIGIN` | — | **Обязательно.** Origin фронтенда |
| `JWT_SECRET` | — | **Обязательно.** Секрет JWT (минимум 32 символа) |
| `DADATA_TOKEN` | — | Токен DaData |
| `MEDIA_ROOT` | `/opt/kppdf/media` | Папка медиафайлов |

`CORS_ORIGIN='*'` запрещен, короткий `JWT_SECRET` тоже блокирует деплой.

---

## Что делает `deploy.sh`

1. Валидирует `deploy/.env`
2. Автоматически очищает auto-generated git-артефакты в `backend/dist` (чтобы сборка на сервере не делала дерево dirty)
3. Делает `git pull --ff-only`
4. Выполняет `npm ci` + `npm run build` в `backend` и `frontend`; frontend install запускается в safe-режиме (без прерывания скрипта), и при peer-conflict автоматически срабатывает fallback `npm ci --legacy-peer-deps`
5. Генерирует `backend/.env`
6. Создает/обновляет `kppdf-backend.service` и перезапускает сервис
7. Копирует фронт-статику в `/var/www/kppdf`
8. Создает/обновляет nginx site, проверяет `nginx -t`, reload
9. Проверяет `GET /health` и доступность веба по HTTP; при наличии сертификата Let's Encrypt автоматически публикует HTTPS-блок и проверяет HTTPS-loopback

Важно по HTTPS:
- если найдены файлы `/etc/letsencrypt/live/<primary-domain>/fullchain.pem` и `privkey.pem`, `deploy.sh` генерирует nginx-конфиг с:
  - `80 -> 301 https://$host$request_uri`
  - отдельным `server` на `443 ssl http2` с теми же proxy/static правилами;
- если сертификата нет, деплой остаётся в HTTP-only режиме (без падения скрипта).

Важно: в nginx для `/api` и `/media` используются префиксные proxy location, чтобы запросы к API/медиа не перехватывались regex-правилом статики (`png/jpg/css/js`).
Legacy-алиасы `/products/*` и `/kp/*` проксируются только для файловых URL (с расширением изображения), чтобы не ломать SPA роуты `/products` и `/kp/:id`.

---

## Повторный деплой

```bash
cd /opt/kppdf
cd deploy
./deploy
```

Опционально:

```bash
# без git pull (если код уже обновили вручную)
./deploy --skip-pull

# разрешить деплой при локальных изменениях в репозитории
./deploy --allow-dirty

# отключить авто-очистку backend/dist перед проверкой dirty-tree
./deploy --no-auto-clean-generated
```

---

## Безопасность данных

- `deploy.sh` **не трогает** `MEDIA_ROOT` (фото и фоны), только создаёт папку при отсутствии.
- Веб-статика обновляется через `rsync --delete` только в `WEB_ROOT` (`/var/www/kppdf`).
- Добавлена защита от опасного удаления: скрипт остановится, если `WEB_ROOT` похож на критический путь (`/`, `/var`, `/root`, пустой путь).
- По умолчанию `git pull` блокируется при dirty-дереве, чтобы не потерять локальные незакоммиченные правки.
- Перед этой проверкой автоматически очищаются только safe auto-generated файлы `backend/dist/*`.
- Для осознанного обхода проверки используйте `--allow-dirty`.

---

## Полезные команды

```bash
# backend логи
journalctl -u kppdf-backend -f

# статус backend
systemctl status kppdf-backend --no-pager

# проверка nginx конфига
nginx -t

# reload nginx
systemctl reload nginx
```

### Важно по regex `location` и `proxy_pass`

Если в nginx используется regex-location (например `location ~* ^/products/...`), в `proxy_pass` нельзя указывать URI-часть (`/products/`, `/kp/`), иначе `nginx -t` падает с ошибкой:

`"proxy_pass" cannot have URI part in location given by regular expression`

Корректно:

```nginx
location ~* ^/products/.+\.(?:png|jpg|jpeg|gif|svg|webp)$ {
  proxy_pass http://127.0.0.1:3000;
}
```

---

## Шпаргалка эксплуатации (prod)

```bash
# 1) Деплой свежего кода
cd /opt/kppdf && git pull --ff-only && sudo bash deploy/deploy.sh --skip-pull

# 2) Статус ключевых сервисов
systemctl status mongod nginx kppdf-backend --no-pager

# 3) Live-логи backend
journalctl -u kppdf-backend -f

# 4) Проверка health backend
curl -I http://127.0.0.1:3000/health

# 5) Проверка сайта по HTTPS
curl -I https://kppdf.ru

# 6) Ручной запуск certbot renew dry-run
certbot renew --dry-run

# 7) Проверка таймера автопродления SSL
systemctl status certbot.timer --no-pager

# 8) Быстрый backup MongoDB (ручной)
mongodump --uri="mongodb://127.0.0.1:27017/kp-app" --archive="/root/restore/mongo-$(date +%F-%H%M%S).archive.gz" --gzip

# 9) Восстановление MongoDB из архива (внимание: --drop)
mongorestore --uri="mongodb://127.0.0.1:27017/kp-app" --archive="/root/restore/mongo-YYYY...archive.gz" --gzip --drop

# 10) Восстановление media + рестарт backend
tar -xzf /root/restore/media-YYYY...tar.gz -C /opt/kppdf/media && systemctl restart kppdf-backend
```

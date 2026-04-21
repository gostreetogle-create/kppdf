# Деплой

## Структура

```
deploy/
├── docker-compose.prod.yml   # Продакшн: mongodb + backend + web (nginx)
├── Dockerfile.backend        # Сборка Express (multi-stage)
├── Dockerfile.web            # Сборка Angular → nginx
├── nginx.conf                # SPA routing + proxy /api/ и /media/ → backend
├── .env.example              # Шаблон переменных окружения
└── deploy.sh                 # Скрипт деплоя (одна команда)
```

`docker-compose.yml` в корне — только для локальной разработки (MongoDB).

---

## Первый деплой на сервер

### Требования
- Docker + Docker Compose v2
- bash
- git

### Шаги

```bash
# 1. Клонировать репозиторий
git clone <repo-url> /opt/kppdf
cd /opt/kppdf

# 2. Создать .env
cp deploy/.env.example deploy/.env
nano deploy/.env   # заполнить CORS_ORIGIN и JWT_SECRET

# 3. Запустить
bash deploy/deploy.sh
```

Приложение будет доступно на `http://<IP>:8080`

---

## Переменные окружения (deploy/.env)

| Переменная      | По умолчанию            | Описание                                      |
|-----------------|-------------------------|-----------------------------------------------|
| `WEB_PORT`      | `8080`                  | Внешний порт nginx                            |
| `BACKEND_PORT`  | `3000`                  | Внешний порт API (для health check)           |
| `MONGO_DB`      | `kp-app`                | Имя базы данных MongoDB                       |
| `CORS_ORIGIN`   | —                       | **Обязательно.** Origin фронтенда для CORS    |
| `JWT_SECRET`    | —                       | **Обязательно.** Секрет JWT (минимум 32 символа) |
| `MONGO_PORT`    | `27017`                 | Внешний порт MongoDB (если нужен доступ с хоста) |

**Примеры CORS_ORIGIN:**
```env
# Локальный compose
CORS_ORIGIN=http://localhost:8080

# Продакшн с доменом
CORS_ORIGIN=https://kp.example.com

# Продакшн по IP
CORS_ORIGIN=http://192.168.1.100:8080
```

`'*'` запрещён — скрипт завершится с ошибкой.
Пустой или короткий `JWT_SECRET` тоже приведёт к ошибке деплоя.

---

## Что делает deploy.sh

1. Проверяет наличие `deploy/.env` и обязательных полей
2. `git pull --ff-only` (если это git-репозиторий)
3. `docker compose build` — пересобирает образы backend и web
4. `docker compose up -d --remove-orphans` — поднимает контейнеры
5. Health check: ждёт ответа `GET /health` до 60 сек
6. Проверяет доступность nginx
7. Выводит итоговые URL

---

## Повторный деплой (обновление)

```bash
bash deploy/deploy.sh
```

Данные MongoDB сохраняются в Docker volume `mongo_data` — не удаляются при пересборке.
Медиафайлы (фото товаров/фон КП) берутся из папки `../media` на хосте, примонтированной в backend как `/app/media`.

---

## Контейнеры

| Контейнер    | Образ           | Порт (внутри сети) | Описание              |
|--------------|-----------------|--------------------|-----------------------|
| `kp-mongo`   | `mongo:7`       | `27017`            | MongoDB               |
| `kp-backend` | build           | `3000`             | Express API           |
| `kp-web`     | build + nginx   | `80`               | Angular SPA + proxy   |

Все контейнеры в сети `kp-net`. Backend обращается к MongoDB по имени `mongodb:27017`.

---

## Nginx

Конфиг: `deploy/nginx.conf`

| Location     | Действие                                      |
|--------------|-----------------------------------------------|
| `/api/`      | Proxy → `http://backend:3000/api/`            |
| `/media/`    | Proxy → `http://backend:3000/media/`          |
| `/products/` | Proxy → `http://backend:3000/products/` (legacy alias) |
| `/kp/`       | Proxy → `http://backend:3000/kp/` (legacy alias) |
| `client_max_body_size` | Лимит тела запроса `100m` (для bulk import) |
| `*.js, *.css`| Статика с кэшем 1 год (`immutable`)           |
| `/index.html`| Без кэша (`no-store`)                         |
| `/*`         | SPA fallback → `/index.html`                  |

---

## Полный сброс данных

```bash
# Остановить и удалить контейнеры + volume с данными
docker compose -f deploy/docker-compose.prod.yml down -v
```

---

## Просмотр логов

```bash
# Все контейнеры
docker compose -f deploy/docker-compose.prod.yml logs -f

# Только backend
docker compose -f deploy/docker-compose.prod.yml logs -f backend

# Только nginx
docker compose -f deploy/docker-compose.prod.yml logs -f web
```

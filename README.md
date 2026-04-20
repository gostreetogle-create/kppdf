# KP PDF — Сервис создания коммерческих предложений

Веб-приложение для создания, редактирования и печати коммерческих предложений в формате A4.

## Стек

| Слой      | Технология                        |
|-----------|-----------------------------------|
| Frontend  | Angular 19, Signals, TypeScript   |
| Backend   | Node.js, Express, TypeScript      |
| База данных | MongoDB (Mongoose)              |
| Веб-сервер | Nginx (продакшн)                 |
| Контейнеры | Docker, Docker Compose           |

## Быстрый старт (локально)

### 1. MongoDB через Docker

```bash
docker-compose up -d
```

### 2. Бэкенд

```bash
cd backend
npm install
npm run dev
```

Сервер: `http://localhost:3000`

### 3. Фронтенд

```bash
cd frontend
npm install
npm start
```

Приложение: `http://localhost:4200`

## Структура репозитория

```
kppdf/
├── backend/          # Express API + MongoDB
├── frontend/         # Angular SPA
├── deploy/           # Docker-файлы, nginx, скрипт деплоя
├── docs/             # Документация
├── docker-compose.yml        # MongoDB для локальной разработки
└── Примеры/          # Примеры деплоя (в .gitignore)
```

## Переменные окружения

### backend/.env

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/kp-app
CORS_ORIGIN=http://localhost:4200
```

## Тесты

```bash
cd frontend
npx ng test --no-watch --browsers=ChromeHeadless
```

## Деплой на сервер

```bash
cp deploy/.env.example deploy/.env
# отредактировать CORS_ORIGIN
bash deploy/deploy.sh
```

Подробнее: [docs/deploy.md](./docs/deploy.md)

## Документация

Полная документация в папке [docs/](./docs/README.md).

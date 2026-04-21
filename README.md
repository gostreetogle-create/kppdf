# KP PDF — Сервис создания коммерческих предложений

Веб-приложение для создания, редактирования и печати КП в формате A4.

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Angular 21, Signals, TypeScript |
| Backend | Node.js 20, Express, TypeScript |
| БД | MongoDB 7 (Mongoose) |
| Auth | JWT 7d + bcryptjs |
| Прод | Nginx + Docker Compose |

## Быстрый старт

```bash
# 1. MongoDB
docker-compose up -d

# 2. Бэкенд
cd backend && npm install && npm run dev   # :3000

# 3. Фронтенд
cd frontend && npm install && npm start    # :4200

# 4. Создать admin + демо-данные
cd backend && npm run seed:admin           # admin@example.com / admin123
cd backend && npm run seed:demo            # 20 товаров, 5 контрагентов, 7 КП
```

## Переменные окружения (`backend/.env`)

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/kp-app
CORS_ORIGIN=http://localhost:4200
JWT_SECRET=your-secret-here
DADATA_TOKEN=your-dadata-token   # для поиска по ИНН
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
ADMIN_NAME=Администратор
```

## Тесты

```bash
cd frontend && npx ng test --no-watch --browsers=ChromeHeadless
```

## Деплой

```bash
cp deploy/.env.example deploy/.env  # заполнить CORS_ORIGIN
bash deploy/deploy.sh
```

## Документация

| Файл | Содержание |
|------|-----------|
| `PROJECT_PASSPORT.md` | Архитектура, карта системы для AI |
| `docs/api.md` | Все REST эндпоинты |
| `docs/business-rules.md` | Бизнес-правила, статусы, расчёты |
| `docs/ui-kit.md` | UI компоненты, токены, Toast |
| `docs/deploy.md` | Деплой, Docker, nginx |
| `docs/architecture.md` | Структура, паттерны, тесты |
| `shared/types/` | Общие TypeScript типы (бэк + фронт) |

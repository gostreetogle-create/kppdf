# KP PDF — Сервис создания коммерческих предложений

Веб-приложение для создания, редактирования и печати КП в формате A4.

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Angular 21, Signals, TypeScript |
| Backend | Node.js 20, Express, TypeScript |
| БД | MongoDB 7 (Mongoose) |
| Auth | JWT 7d + bcryptjs |
| Прод | Nginx + systemd (без Docker) |

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

## Переменные окружения

Скопируйте шаблон и заполните:

```bash
cp deploy/.env.example deploy/.env
# Отредактируйте deploy/.env — все обязательные переменные описаны в комментариях.
```

Или для локальной разработки создайте `backend/.env` на основе `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

> ⚠️ **Никогда** не коммитьте `.env` с реальными паролями/токенами. Файл `.gitignore` уже исключает `backend/.env` и `deploy/.env`.

Обязательные переменные:
- `JWT_SECRET` — минимум 32 символа, сгенерируйте: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `MONGO_URI` — строка подключения MongoDB
- `CORS_ORIGIN` — URL фронтенда (напр. `http://localhost:4200`)
- `DOMAIN` — домен для HTTPS (для deploy.sh)

## Тесты

```bash
cd frontend && npx ng test --no-watch --browsers=ChromeHeadless
```

## Деплой

```bash
cp deploy/.env.example deploy/.env  # заполнить DOMAIN/CORS_ORIGIN/JWT_SECRET
sudo bash deploy/deploy.sh
```

## Документация

| Файл | Содержание |
|------|-----------|
| `PROJECT_PASSPORT.md` | Архитектура, карта системы для AI |
| `docs/api.md` | Все REST эндпоинты |
| `docs/business-rules.md` | Бизнес-правила, статусы, расчёты |
| `docs/ui-kit.md` | UI компоненты, токены, Toast |
| `docs/deploy.md` | Деплой без Docker (systemd + nginx) |
| `docs/architecture.md` | Структура, паттерны, тесты |
| `shared/types/` | Общие TypeScript типы (бэк + фронт) |

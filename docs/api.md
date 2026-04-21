# REST API

Base URL: `http://localhost:3000/api` (dev) / `/api` (prod через nginx)  
Auth: `Authorization: Bearer <token>` — все роуты кроме `/api/auth/*` и `GET /health`  
Ошибки: `400` неверные данные, `401` не авторизован, `404` не найдено, `500` сервер

---

## Health

| Метод | Путь | Ответ |
|-------|------|-------|
| GET | `/health` | `{ status: 'ok', uptime: number }` — публичный |

---

## Auth

| Метод | Путь | Тело | Ответ |
|-------|------|------|-------|
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: { _id, email, name, role } }` |
| POST | `/api/auth/logout` | — | `{ message }` |
| GET | `/api/auth/me` | — | `IUser` без passwordHash |

Rate limit: 10 попыток / 15 мин с одного IP.

---

## Products

Валидация POST/PUT: `code` (непустой, уникальный), `name`, `unit`, `price` (>= 0).

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/products` | Список. Фильтры: `?category=&kind=ITEM\|SERVICE\|WORK&isActive=true&q=` |
| GET | `/api/products/categories` | Уникальные категории (справочник + из товаров) |
| GET | `/api/products/:id` | Один товар |
| POST | `/api/products` | Создать |
| PUT | `/api/products/:id` | Обновить |
| DELETE | `/api/products/:id` | Удалить |

**Product schema:**
```json
{
  "_id": "string",
  "code": "string (unique)",
  "name": "string",
  "description": "string",
  "category": "string",
  "subcategory": "string?",
  "unit": "string",
  "price": "number",
  "costRub": "number?",
  "images": [{ "url": "string", "isMain": "boolean", "sortOrder": "number" }],
  "isActive": "boolean",
  "kind": "ITEM | SERVICE | WORK",
  "notes": "string?"
}
```

---

## KP

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/kp` | Список (новые первые) |
| GET | `/api/kp/:id` | Одно КП |
| POST | `/api/kp` | Создать черновик |
| PUT | `/api/kp/:id` | Сохранить целиком |
| DELETE | `/api/kp/:id` | Удалить |
| POST | `/api/kp/:id/duplicate` | Дублировать → новый `_id`, `status: draft`, `title: "Копия — ..."` |

**KP schema (ключевые поля):**
```json
{
  "_id": "string",
  "title": "string",
  "status": "draft | sent | accepted | rejected",
  "counterpartyId": "string?",
  "recipient": {
    "name": "string", "shortName": "string?", "legalForm": "string?",
    "inn": "string?", "kpp": "string?", "ogrn": "string?",
    "legalAddress": "string?", "phone": "string?", "email": "string?",
    "bankName": "string?", "bik": "string?",
    "checkingAccount": "string?", "correspondentAccount": "string?",
    "founderName": "string?", "founderNameShort": "string?"
  },
  "metadata": {
    "number": "string", "validityDays": 10,
    "prepaymentPercent": 50, "productionDays": 15
  },
  "items": [{
    "productId": "string", "code": "string?", "name": "string",
    "description": "string", "unit": "string",
    "price": "number", "qty": "number (>=1)", "imageUrl": "string?"
  }],
  "conditions": ["string"],
  "vatPercent": 20
}
```

---

## Counterparties

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/counterparties/lookup?inn=` | DaData поиск → данные для автозаполнения. Требует `DADATA_TOKEN`. |
| GET | `/api/counterparties` | Список. Фильтры: `?role=client\|supplier&status=active&q=` |
| GET | `/api/counterparties/:id` | Один контрагент |
| POST | `/api/counterparties` | Создать |
| PUT | `/api/counterparties/:id` | Обновить |
| DELETE | `/api/counterparties/:id` | Удалить |

---

## Dictionaries

Справочники: `category`, `subcategory`, `unit`, `kind`. Уникальный индекс `type + value`.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/dictionaries?type=category` | Список активных записей |
| POST | `/api/dictionaries` | Создать запись |
| PUT | `/api/dictionaries/:id` | Обновить |
| DELETE | `/api/dictionaries/:id` | Удалить |

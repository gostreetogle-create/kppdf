# REST API

Base URL: `http://localhost:3000/api`

В продакшне запросы проксируются через nginx: `/api/` → `http://backend:3000/api/`

---

## Products

### GET /api/products
Список всех товаров, отсортированных по дате создания (новые первые).

**Response 200**
```json
[
  {
    "_id": "664a1b2c3d4e5f6a7b8c9d0e",
    "name": "Металлоконструкция стальная",
    "description": "Изготовление по чертежам заказчика",
    "unit": "шт.",
    "price": 25000,
    "imageUrl": "/kp/kp-1str.png",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---

### GET /api/products/:id
Один товар по ID.

**Response 200** — объект товара  
**Response 404** `{ "message": "Товар не найден" }`  
**Response 400** `{ "message": "Неверный ID" }`

---

### POST /api/products
Создать товар.

**Request body**
```json
{
  "name": "Покраска порошковая",
  "description": "RAL 7024, полимерное покрытие",
  "unit": "м²",
  "price": 500,
  "imageUrl": "/kp/kp-2str.png"
}
```

**Валидация**
- `name` — обязательно, непустая строка
- `unit` — обязательно, непустая строка
- `price` — обязательно, число >= 0

**Response 201** — созданный объект  
**Response 400** `{ "errors": ["name обязателен", "price должен быть числом >= 0"] }`

---

### PUT /api/products/:id
Обновить товар. Тело и валидация — как у POST.

**Response 200** — обновлённый объект  
**Response 404** `{ "message": "Товар не найден" }`

---

### DELETE /api/products/:id
Удалить товар.

**Response 204** — нет тела  
**Response 404** `{ "message": "Товар не найден" }`

---

## KP (Коммерческие предложения)

### GET /api/kp
Список всех КП, отсортированных по дате создания (новые первые).

**Response 200**
```json
[
  {
    "_id": "664a1b2c3d4e5f6a7b8c9d0f",
    "title": "КП для ООО Ромашка",
    "status": "draft",
    "recipient": {
      "name": "ООО Ромашка",
      "inn": "1234567890",
      "email": "info@romashka.ru",
      "phone": "+7 (999) 123-45-67"
    },
    "metadata": {
      "number": "КП-2024-001",
      "validityDays": 10,
      "prepaymentPercent": 50,
      "productionDays": 15
    },
    "items": [
      {
        "productId": "664a1b2c3d4e5f6a7b8c9d0e",
        "name": "Металлоконструкция стальная",
        "description": "Изготовление по чертежам",
        "unit": "шт.",
        "price": 25000,
        "qty": 2,
        "imageUrl": "/kp/kp-1str.png"
      }
    ],
    "conditions": [
      "Цены действительны 10 дней.",
      "Оплата: 50% предоплата."
    ],
    "vatPercent": 20,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
]
```

---

### GET /api/kp/:id
Одно КП по ID.

**Response 200** — объект КП  
**Response 404** `{ "message": "Not found" }`

---

### POST /api/kp
Создать КП. Обычно вызывается с минимальным набором полей — черновик.

**Request body (минимальный)**
```json
{
  "title": "Новое КП",
  "status": "draft",
  "recipient": { "name": "" },
  "metadata": {
    "number": "КП-1713612345678",
    "validityDays": 10,
    "prepaymentPercent": 50,
    "productionDays": 15
  },
  "items": [],
  "conditions": [],
  "vatPercent": 20
}
```

**Response 201** — созданный объект КП  
**Response 400** `{ "message": "..." }` — ошибка валидации Mongoose

---

### PUT /api/kp/:id
Сохранить КП целиком. Фронтенд отправляет весь объект.

**Request body** — полный объект КП (как в GET /api/kp/:id)

**Response 200** — обновлённый объект  
**Response 404** `{ "message": "Not found" }`

---

### DELETE /api/kp/:id
Удалить КП.

**Response 204** — нет тела

---

## Коды ошибок

| Код | Значение                              |
|-----|---------------------------------------|
| 400 | Неверные данные / невалидный ID       |
| 404 | Объект не найден                      |
| 500 | Внутренняя ошибка сервера             |

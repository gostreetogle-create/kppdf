# REST API

Base URL: `http://localhost:3000/api` (dev) / `/api` (prod через nginx)  
Auth: `Authorization: Bearer <token>` — все роуты кроме `/api/auth/*`, `/api/guest/enter/:token` и `GET /health`  
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
| POST | `/api/auth/login` | `{ username, password, rememberMe? }` | `{ accessToken, refreshToken, user: { _id, username, name, role, isActive, mustChangePassword } }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` (rotation) |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` | `{ message }` |
| POST | `/api/auth/logout` | — | `{ message }` |
| GET | `/api/auth/me` | — | `IUser` без `passwordHash` |

Rate limit: 10 попыток / 15 мин с одного IP.

JWT TTL конфигурируется переменными окружения backend:
- `JWT_ACCESS_EXPIRES` (например `1h`);
- `JWT_REFRESH_EXPIRES` (например `30d`).

Client-side session persistence:
- `rememberMe=true`: frontend хранит auth-сессию в `localStorage`;
- `rememberMe=false`: frontend хранит auth-сессию в `sessionStorage` (до закрытия вкладки/окна).

---

## Guest Preview

| Метод | Путь | Тело | Ответ |
|-------|------|------|-------|
| POST | `/api/guest/issue` | `{ ttlDays?: number }` | `{ previewUrl, expiresInSeconds }` |
| POST | `/api/guest/enter/:token` | — | `{ accessToken, user }` |

Правила:
- `POST /api/guest/issue` доступен только авторизованному пользователю с permission `users.manage`.
- `ttlDays` ограничен `1..30` (по умолчанию `7`).
- Гостевая сессия получает read-only доступ: backend блокирует любые write-запросы (`POST/PUT/PATCH/DELETE`) с `403`.
- `POST /api/guest/enter/:token` возвращает только `accessToken` (без `refreshToken`).

---

## Products

Валидация POST/PUT: `code` (непустой, уникальный), `name`, `unit`, `price` (>= 0).

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/products` | Список. Фильтры: `?category=&kind=ITEM\|SERVICE\|WORK&isActive=true&q=&hasSpec=true\|false` |
| GET | `/api/products/categories` | Уникальные категории (справочник + из товаров) |
| GET | `/api/products/:id` | Один товар |
| POST | `/api/products/bulk` | Массовый импорт JSON: `{ items: Product[], mode: "skip" \| "update" }` |
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

Дополнительно в ответе списка/карточки товара возвращается:
- `specId?: string` — id технического профиля (`ProductSpec`), если он существует.

---

## Product Specs

Гибкие технические характеристики хранятся отдельно от `Product` в коллекции `ProductSpec` (связь `1:1` по `productId`).

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/product-specs/:productId` | Получить профиль товара по `productId` |
| GET | `/api/product-specs/templates` | Получить список шаблонов ProductSpec (`settings`-driven, с fallback) |
| PUT | `/api/product-specs/:productId` | Upsert профиля товара по `productId` |
| POST | `/api/product-specs/upload-drawing` | Upload чертежа (`multipart/form-data`, поле `file`) |

Backward-compatible aliases (для существующих клиентов):
- `GET /api/product-specs/product/:productId`
- `PUT /api/product-specs/product/:productId`
- `POST /api/product-specs/upload`

RBAC:
- `GET` требует `products.view`;
- `PUT` и `POST upload-drawing` дополнительно ограничены ролями `owner/admin`.

Шаблоны ProductSpec:
- endpoint `GET /api/product-specs/templates` возвращает массив:
```json
[
  {
    "key": "sport-stand",
    "name": "Спортивный стенд",
    "groups": [
      {
        "title": "Габариты",
        "params": [{ "name": "Длина", "value": "2000 мм" }]
      }
    ]
  }
]
```
- источник данных: `settings` key `product_spec_templates_v1`;
- если ключ пустой или невалидный, backend возвращает встроенный fallback-набор шаблонов.

Поведение отсутствующей спецификации:
- `GET /api/product-specs/:productId` возвращает `200` с `null`, если профиль еще не создан (не считается ошибкой).

`drawings`:
```json
{
  "viewFront": "string?",
  "viewSide": "string?",
  "viewTop": "string?",
  "view3D": "string?"
}
```

`groups`:
```json
[
  {
    "title": "Материалы каркаса",
    "params": [
      { "name": "Материал", "value": "Сталь х/к" },
      { "name": "Толщина", "value": "3 мм" }
    ]
  }
]
```

---

## KP

Архитектурно: HTTP-слой вынесен в `backend/src/controllers/kp.controller.ts`, бизнес-логика в `backend/src/services/kp.service.ts`; файл `backend/src/routes/kp.routes.ts` отвечает за RBAC + route wiring.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/kp` | Список (новые первые) |
| GET | `/api/kp/:id` | Одно КП |
| GET | `/api/kp/:id/export` | HQ-экспорт КП в PDF через frontend route (`application/pdf`, `Content-Disposition: attachment`) |
| GET | `/api/kp/passport/:productId/export` | Экспорт технического паспорта товара в PDF |
| POST | `/api/kp` | Создать черновик (можно без `companyId`/`kpType` — сервер возьмёт default-инициатора и `kpType=standard`; опц. `templateKey`) |
| PUT | `/api/kp/:id` | Сохранить целиком (включены `runValidators: true`, `context: "query"`) |
| PUT | `/api/kp/:id/switch-type` | Переключить тип/шаблон существующего КП с пересборкой `companySnapshot` и безопасной политикой условий |
| DELETE | `/api/kp/:id` | Удалить |
| POST | `/api/kp/:id/duplicate` | Дублировать → новый `_id`, `status: draft`, `title: "Копия — ..."` |

`GET /api/kp/:id/export` (HQ):
- backend рендерит server-side HTML документа (`kp-pdf.service`) и генерирует PDF через Puppeteer без промежуточного браузерного маршрута;
- ожидание готовности: `page.setContent(..., { waitUntil: 'networkidle0' })`;
- параметры PDF: `A4`, `printBackground: true`, `displayHeaderFooter: true`;
- колонтитулы: header с названием КП и датой, footer с нумерацией `Страница X из Y`;
- поля страницы: top/bottom увеличены под колонтитулы (`top: 18mm`, `bottom: 16mm`);
- ошибки: `404` если КП не найдено, `500` если генерация PDF завершилась неуспешно.

**KP schema (ключевые поля):**
```json
{
  "_id": "string",
  "title": "string",
  "status": "draft | sent | accepted | rejected",
  "kpType": "standard | response | special | tender | service",
  "counterpartyId": "string?",
  "companyId": "string",
  "companySnapshot": {
    "companyId": "string",
    "companyName": "string",
    "templateKey": "string",
    "templateName": "string",
    "kpType": "standard | response | special | tender | service",
    "assets": {
      "kpPage1": "string",
      "kpPage2": "string?",
      "passport": "string?",
      "appendix": "string?"
    },
    "texts": {
      "headerNote": "string?",
      "introText": "string?",
      "footerText": "string? (HTML)",
      "closingText": "string?"
    },
    "requisitesSnapshot": {
      "inn": "string?",
      "kpp": "string?",
      "ogrn": "string?",
      "phone": "string?",
      "email": "string?"
    }
  },
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
    "prepaymentPercent": 50, "productionDays": 15,
    "tablePageBreakAfter": 6,
    "tablePageBreakFirstPage": 6,
    "tablePageBreakNextPages": 6,
    "photoScalePercent": 150,
    "defaultMarkupPercent": 0,
    "defaultDiscountPercent": 0
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

Валидация реквизитов при обновлении/создании КП:
- `recipient.inn` и `companySnapshot.requisitesSnapshot.inn`: `^\\d{10}(\\d{2})?$`
- `recipient.bik` и `companySnapshot.requisitesSnapshot.bik`: `^\\d{9}$`
- `recipient.checkingAccount` / `recipient.correspondentAccount` и соответствующие поля snapshot: `^\\d{20}$`

Пагинация таблицы товаров в КП:
- `metadata.tablePageBreakFirstPage` — лимит строк на 1-й странице;
- `metadata.tablePageBreakNextPages` — лимит строк на 2+ страницах;
- `metadata.tablePageBreakAfter` остаётся как backward-compatible fallback для старых КП;
- frontend `kp-document` использует детерминированное разбиение: первая/следующие страницы + баланс последней страницы (чтобы не оставлять «одинокие» 1-2 строки на финальной странице).

---

## Counterparties

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/counterparties/lookup?inn=` | DaData поиск → данные для автозаполнения. Требует `DADATA_TOKEN`. |
| GET | `/api/counterparties/company` | Наша компания (`isOurCompany=true`) для подстановки в КП |
| GET | `/api/counterparties` | Список. Фильтры: `?role=client\|supplier\|company&status=active\|inactive&q=&isOurCompany=true\|false` |
| POST | `/api/counterparties/upload-branding-image` | Upload изображения шаблона КП (`multipart/form-data`, поле `file`) |
| GET | `/api/counterparties/:id/branding-templates` | Шаблоны брендирования компании по типам КП (`kpTypes`, `templatesByType`, `defaultByType`) |
| PUT | `/api/counterparties/:id/branding-templates` | Обновить полный список `brandingTemplates` для нашей компании |
| POST | `/api/counterparties/bulk` | Массовый импорт JSON: `{ items: Counterparty[], mode: "skip" \| "update" }` |
| GET | `/api/counterparties/:id` | Один контрагент |
| POST | `/api/counterparties` | Создать |
| PUT | `/api/counterparties/:id` | Обновить |
| DELETE | `/api/counterparties/:id` | Удалить |

Для компаний-инициаторов поддерживается флаг `isDefaultInitiator: boolean`:
- при `GET /api/counterparties/company` сервер возвращает приоритетно запись с `isDefaultInitiator=true` (если есть);
- при `POST/PUT /api/counterparties` если сохраняется `isDefaultInitiator=true`, сервер автоматически сбрасывает этот флаг у остальных `isOurCompany=true`.

Валидация контрагентов возвращает человекочитаемые сообщения на русском языке (без английских префиксов Mongoose): например `Краткое название обязательно`, `ИНН должен содержать 10 или 12 цифр`, `Контрагент с таким ИНН уже существует`.  
Особенность по ИНН: для `legalForm="Физлицо"` поле `inn` опционально; для остальных оргформ — обязательно.
Шаблоны брендирования (`brandingTemplates`) валидируются на сервере: обязательны `name`, `kpType`, `assets.kpPage1`; `key` уникален в рамках компании; `isDefault=true` не может повторяться внутри одного `kpType`.
При `POST /api/kp` и `PUT /api/kp/:id/switch-type` в режиме `Авто` (`templateKey` не передан) выбор шаблона делается так: сначала `isDefault=true` для нужного `kpType`, если default отсутствует — первый доступный шаблон этого `kpType`; если шаблонов нужного типа нет, возвращается `400`.
`PUT /api/kp/:id/switch-type` поддерживает смену компании-инициатора через `companyId` в теле запроса (с тем же пересчётом snapshot/шаблона/условий).
В шаблоне доступен список `conditions: string[]` (пункты условий КП). При `POST /api/kp`, если `conditions` не передан или пустой, сервер подставляет `selectedTemplate.conditions`.
`PUT /api/kp/:id/switch-type` возвращает `{ kp, meta }`, где `meta.conditionsReplaced` показывает, были ли условия заменены на шаблонные (замена происходит только если пользователь не менял их вручную, либо при `overwriteConditions=true`).
Для legacy-совместимости switch-type принимает компанию-инициатора как `isOurCompany=true` или как историческую запись с `role` содержащей `company`.
Если в старом КП пустой корневой `companyId`, switch-type использует fallback `companySnapshot.companyId`.
Если в старом `companySnapshot` отсутствует объект `texts`, switch-type нормализует его в пустую структуру (`headerNote/introText/footerText/closingText`), чтобы не ломаться на Mongoose-cast.
Для контрагента-инициатора поддержаны `defaultMarkupPercent/defaultDiscountPercent`; сервер прокидывает их в `Kp.metadata.defaultMarkupPercent/defaultDiscountPercent` при создании КП и при switch-type.
Нумерация type-aware: `response` получает префикс `ПИСЬМО-xxx`, остальные типы — `КП-xxx`.

---

## Dictionaries

Справочники: `category`, `subcategory`, `unit`, `kind`. Уникальный индекс `type + value`.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/dictionaries?type=category` | Список активных записей |
| POST | `/api/dictionaries` | Создать запись |
| PUT | `/api/dictionaries/:id` | Обновить |
| DELETE | `/api/dictionaries/:id` | Удалить |

---

## Settings

Все роуты ниже защищены permission-based RBAC:
- `settings.write` для настроек и справочников
- `backups.manage` для операций с бэкапами

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/settings` | Получить настройки (`{ list, map }`) |
| PUT | `/api/settings/:key` | Обновить одну настройку |
| PUT | `/api/settings` | Массово обновить настройки |
| GET | `/api/settings/backups` | Список архивов бэкапов (`mongo` + `media`) |
| POST | `/api/settings/backups/run` | Запустить ручной бэкап сейчас |
| GET | `/api/settings/backups/download/:type/:filename` | Скачать архив |
| DELETE | `/api/settings/backups/:type/:filename` | Удалить архив |
| DELETE | `/api/settings/backups/cleanup?days=7&type=all` | Удалить архивы старше `days` |

`type` для бэкапов: `mongo`, `media`, `all` (только для cleanup).

Дополнительные ключи `settings`:
- `rbac_labels` — объект с пользовательскими подписями ролей и полномочий для UI (`roles`, `permissions`).
- `passport_warranty_text` — текст блока «Гарантия» в PDF техпаспорта.
- `passport_storage_text` — текст блока «Хранение и транспортировка» в PDF техпаспорта.
- `product_spec_templates_v1` — JSON-массив шаблонов техпаспорта (`key`, `name`, `groups[].params[]`) для быстрого заполнения ProductSpec редактора.

---

## Users

Все роуты ниже требуют permission: `users.manage`.

| Метод | Путь | Тело | Описание |
|-------|------|------|----------|
| GET | `/api/users` | — | Список пользователей |
| POST | `/api/users` | `{ username, name, role, password }` | Создать пользователя (с `mustChangePassword=true`) |
| PATCH | `/api/users/:id` | `{ username?, name?, role?, isActive?, mustChangePassword? }` | Обновить логин/профиль/роль/статус |
| POST | `/api/users/:id/reset-password` | `{ password }` | Сбросить пароль и потребовать смену на первом входе |
| DELETE | `/api/users/:id` | — | Удалить пользователя (запрещено удалять самого себя) |

Поля пользователя в ответах:
- `roleId: string | null`
- `roleKey: string`
- `roleName: string`
- `isSystemRole?: boolean`

---

## Roles & Permissions

Все роуты ниже требуют permission: `users.manage`.

| Метод | Путь | Тело | Описание |
|-------|------|------|----------|
| GET | `/api/roles` | — | Список всех ролей (`_id`, `name`, `key`, `isSystem`, `permissions`) |
| POST | `/api/roles` | `{ name, copyFromRoleId? }` | Создать кастомную роль |
| PUT | `/api/roles/:id/name` | `{ name }` | Обновить название роли |
| PUT | `/api/roles/:id/permissions` | `{ permissions: string[] }` | Обновить permissions роли (запрещено для `owner/admin`) |
| DELETE | `/api/roles/:id` | — | Удалить кастомную роль (пользователи переназначаются на `manager`) |
| GET | `/api/permissions` | — | Каталог доступных permission (`key`, `label`, `module`, `description`) |

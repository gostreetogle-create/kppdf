# PROJECT PASSPORT — KP PDF

> Единый документ-паспорт проекта. Читается за 10 минут — достаточно чтобы полностью понять систему.
> Детали — в `docs/`. При каждом значимом изменении обновлять этот файл и соответствующий doc.

---

## 1. ПРОЕКТ

**Название:** KP PDF  
**Назначение:** Веб-приложение для создания, редактирования и печати коммерческих предложений в формате A4.  
**Целевая аудитория:** Менеджеры по продажам (2–5 человек), которые формируют КП для клиентов.

### Технологический стек

| Слой           | Технология                                      | Версия   |
|----------------|-------------------------------------------------|----------|
| Frontend       | Angular (standalone components, Signals)        | 21.x     |
| Backend        | Node.js + Express + TypeScript                  | 20 / 4.x |
| База данных    | MongoDB (Mongoose ODM)                          | 7 / 8.x  |
| Авторизация    | JWT (jsonwebtoken) + bcryptjs                   | —        |
| Веб-сервер     | Nginx (продакшн, SPA + proxy)                   | 1.27     |
| Контейнеры     | Docker + Docker Compose                         | v2       |
| Тесты          | Karma + Jasmine (Angular)                       | —        |

### Структура репозитория

```
kppdf/
├── backend/
│   └── src/
│       ├── middleware/         # auth.middleware.ts (JWT guard)
│       ├── models/             # User, Product, Kp, Counterparty, Dictionary
│       ├── routes/             # auth, product, kp, counterparty, dictionary
│       ├── scripts/            # seed-admin.ts
│       └── app.ts
├── frontend/
│   └── src/
│       ├── styles/             # _tokens.scss, _global.scss
│       └── app/
│           ├── core/
│           │   ├── components/ # AppShellComponent (шапка + навигация)
│           │   ├── guards/     # auth.guard.ts
│           │   ├── interceptors/ # auth.interceptor.ts
│           │   └── services/   # ApiService, AuthService
│           ├── features/
│           │   ├── auth/       # LoginComponent
│           │   ├── home/       # Список КП
│           │   ├── kp/         # Редактор КП + компоненты документа A4
│           │   └── products/   # Каталог товаров (CRUD)
│           └── shared/ui/      # UI kit: Button, Badge, Modal, FormField, Alert
├── deploy/                     # Dockerfile.backend, Dockerfile.web, nginx.conf,
│                               # docker-compose.prod.yml, deploy.sh, .env.example
├── docs/                       # Детальная документация
├── docker-compose.yml          # MongoDB для локальной разработки
└── PROJECT_PASSPORT.md
```

---

## 2. АРХИТЕКТУРА

### Схема взаимодействия

```
Браузер
  │
  ├── Angular SPA (порт 4200 локально / nginx:80 прод)
  │     ├── LoginComponent         ─── POST /api/auth/login
  │     ├── AppShellComponent      ─── GET /api/auth/me, POST /api/auth/logout
  │     ├── HomeComponent          ─── GET/POST/DELETE /api/kp
  │     │                              POST /api/kp/:id/duplicate
  │     ├── ProductsComponent      ─── GET/POST/PUT/DELETE /api/products
  │     │                              GET /api/products/categories
  │     │                              GET /api/dictionaries
  │     └── KpBuilderComponent     ─── GET /api/kp/:id, PUT /api/kp/:id
  │                                    GET /api/products
  │                                    GET /api/counterparties
  │
  └── Nginx (порт 8080 прод)
        ├── /api/* → proxy → Express (порт 3000)
        └── /* → Angular index.html (SPA fallback)

Express API (порт 3000)
  ├── /api/auth          → auth.routes.ts        (публичный)
  ├── /api/products      → product.routes.ts     (authGuard)
  ├── /api/kp            → kp.routes.ts          (authGuard)
  ├── /api/counterparties→ counterparty.routes.ts(authGuard)
  └── /api/dictionaries  → dictionary.routes.ts  (authGuard)

MongoDB (порт 27017)
  ├── users
  ├── products
  ├── kps
  ├── counterparties
  └── dictionaries
```

### Поток данных — авторизация

```
1. LoginComponent → POST /api/auth/login → { token, user }
2. AuthService сохраняет token в localStorage
3. authInterceptor добавляет Authorization: Bearer <token> к каждому запросу
4. При 401 — authInterceptor вызывает AuthService.logout() → редирект на /login
5. authGuard проверяет AuthService.isAuthenticated() перед каждым защищённым маршрутом
```

### Поток данных — добавить товар в КП

```
1. Пользователь нажимает "+" у товара в сайдбаре
2. KpBuilderComponent.addItem(product) — иммутабельное обновление signal
3. computed(catalogItems/subtotal/vatAmount/total) пересчитываются автоматически
4. KpDocumentComponent получает новые items через input() → ре-рендер превью
5. AutosaveService.schedule(kp) — запускает debounce 2 сек
6. По истечении → PUT /api/kp/:id → MongoDB
```

### Ключевые архитектурные решения

| Решение | Почему |
|---------|--------|
| Angular Signals вместо RxJS для состояния | Нативная мемоизация через `computed()`, меньше бойлерплейта |
| `takeUntilDestroyed()` на всех подписках | Автоматическая отписка без `ngOnDestroy` |
| `shareReplay(1)` для списка товаров | Каталог запрашивается в двух местах, кэш экономит запросы |
| Иммутабельные обновления сигналов | Мутация вложенных объектов не триггерит Angular change detection |
| Smart/Dumb разделение | Smart — знают об API, Dumb — только `input()`/`output()` |
| UI Kit через host-классы | `button[ui-btn]` — нативный элемент без лишней обёртки в DOM |
| Данные товара копируются в КП (снимок) | Изменение каталога не ломает существующие КП |
| JWT в localStorage | Простота для небольшой команды, без refresh-токенов |
| Dictionary — гибридный справочник | Строки в товарах + коллекция для управления. Импорт работает без предварительной настройки |
| Единая таблица Counterparty с role[] | Компания может быть одновременно клиентом и поставщиком |

---

## 3. СУЩНОСТИ И ДАННЫЕ

### User (коллекция `users`)

| Поле           | Тип    | Обязательно | Описание                    |
|----------------|--------|-------------|-----------------------------|
| `email`        | String | ✅ unique    | Email (lowercase)           |
| `passwordHash` | String | ✅           | bcrypt hash                 |
| `name`         | String | ✅           | Имя пользователя            |
| `role`         | String | —           | `admin` / `manager`         |

Создание первого admin: `npm run seed:admin` (backend).

---

### Product (коллекция `products`)

| Поле          | Тип            | Обязательно | По умолчанию | Описание                        |
|---------------|----------------|-------------|--------------|----------------------------------|
| `code`        | String         | ✅ unique    | —            | Артикул                         |
| `name`        | String         | ✅           | —            | Название                        |
| `description` | String         | —           | `''`         | Описание                        |
| `category`    | String         | —           | `''`         | Категория (строка, из Dictionary)|
| `subcategory` | String         | —           | —            | Подкатегория                    |
| `unit`        | String         | ✅           | —            | Единица измерения               |
| `price`       | Number         | ✅           | —            | Цена продажи, ₽ (>= 0)         |
| `costRub`     | Number         | —           | —            | Себестоимость, ₽                |
| `images`      | ProductImage[] | —           | `[]`         | Фотографии (см. ниже)           |
| `isActive`    | Boolean        | —           | `true`       | Активен / в архиве              |
| `kind`        | String         | —           | `'ITEM'`     | `ITEM` / `SERVICE` / `WORK`     |
| `notes`       | String         | —           | —            | Внутренние заметки              |

**ProductImage:** `{ url: string, isMain: boolean, sortOrder: number }`  
Главное фото: `images.find(i => i.isMain)` или первое по `sortOrder`.  
В КП копируется только URL главного фото.

---

### Kp (коллекция `kps`)

| Поле             | Тип       | По умолчанию | Описание                        |
|------------------|-----------|--------------|---------------------------------|
| `title`          | String    | —            | Название КП (внутреннее)        |
| `status`         | String    | `'draft'`    | `draft/sent/accepted/rejected`  |
| `counterpartyId` | String    | —            | Мягкая ссылка на Counterparty   |
| `recipient`      | Object    | —            | Снимок данных получателя        |
| `metadata`       | Object    | —            | Параметры КП                    |
| `items`          | KpItem[]  | `[]`         | Позиции (снимок из каталога)    |
| `conditions`     | String[]  | `[]`         | Доп. условия                    |
| `vatPercent`     | Number    | `20`         | Ставка НДС, %                   |

**recipient:** `{ name, shortName?, legalForm?, inn?, kpp?, ogrn?, legalAddress?, phone?, email?, bankName?, bik?, checkingAccount?, correspondentAccount?, founderName?, founderNameShort? }`  
**metadata:** `{ number, validityDays=10, prepaymentPercent=50, productionDays=15 }`  
**KpItem:** `{ productId, code?, name, description, unit, price, qty=1, imageUrl? }`

---

### Counterparty (коллекция `counterparties`)

| Поле                  | Тип       | Описание                                    |
|-----------------------|-----------|---------------------------------------------|
| `legalForm`           | String    | `ООО/ИП/АО/ПАО/Физлицо/Другое`             |
| `role`                | String[]  | `['client']` / `['supplier']` / оба         |
| `name`                | String    | Полное название: ООО "СпортИН-ЮГ"           |
| `shortName`           | String    | Краткое: СпортИН-ЮГ                         |
| `inn`                 | String    | ИНН (10 — юрлицо, 12 — ИП)                 |
| `kpp`                 | String    | КПП (только юрлица)                         |
| `ogrn`                | String    | ОГРН / ОГРНИП                               |
| `legalAddress`        | String    | Юридический адрес                           |
| `actualAddress`       | String    | Фактический адрес                           |
| `sameAddress`         | Boolean   | Совпадает с юридическим                     |
| `phone/email/website` | String    | Контакты                                    |
| `contacts`            | Object[]  | `{ name, position?, phone?, email? }`       |
| `bankName/bik`        | String    | Банковские реквизиты                        |
| `checkingAccount`     | String    | Расчётный счёт                              |
| `correspondentAccount`| String    | Корреспондентский счёт                      |
| `founderName`         | String    | ФИО для ИП: Иванов Иван Иванович            |
| `founderNameShort`    | String    | И.И. Иванов (для документов)               |
| `status`              | String    | `active` / `inactive`                       |
| `notes/tags`          | String/[] | Заметки и метки                             |

---

### Dictionary (коллекция `dictionaries`)

Гибридный справочник для выпадающих списков. Уникальный индекс по `type + value`.

| Поле        | Тип    | Описание                                          |
|-------------|--------|---------------------------------------------------|
| `type`      | String | `category` / `subcategory` / `unit` / `kind`      |
| `value`     | String | Значение (напр. «Воркаут», «шт.»)                 |
| `sortOrder` | Number | Порядок в списке                                  |
| `isActive`  | Boolean| Показывать в списке                               |

---

### Связи

```
User          — независимая коллекция, авторизация
Product       — независимая коллекция, каталог
Dictionary    — независимая коллекция, справочники
Counterparty  — независимая коллекция, контрагенты

Kp.counterpartyId → Counterparty._id  (мягкая ссылка, не FK)
Kp.items[].productId → Product._id    (мягкая ссылка, данные скопированы)
```

---

## 4. API

Base URL: `http://localhost:3000/api`  
Авторизация: JWT Bearer token. Все роуты кроме `/api/auth/*` и `GET /health` требуют заголовок `Authorization: Bearer <token>`.

### Health

| Метод | Путь      | Описание                              |
|-------|-----------|---------------------------------------|
| GET   | `/health` | `{ status: 'ok', uptime }` — публичный |

### Auth

| Метод | Путь              | Описание                                    |
|-------|-------------------|---------------------------------------------|
| POST  | `/api/auth/login` | `{ email, password }` → `{ token, user }`   |
| POST  | `/api/auth/logout`| Выход (клиент удаляет токен)                |
| GET   | `/api/auth/me`    | Текущий пользователь по токену              |

### Products

| Метод  | Путь                        | Описание                                          |
|--------|-----------------------------|---------------------------------------------------|
| GET    | `/api/products`             | Список. Фильтры: `?category=&kind=&isActive=&q=`  |
| GET    | `/api/products/categories`  | Уникальные категории (справочник + из товаров)    |
| GET    | `/api/products/:id`         | Один товар                                        |
| POST   | `/api/products`             | Создать (валидация: code, name, unit, price)      |
| PUT    | `/api/products/:id`         | Обновить                                          |
| DELETE | `/api/products/:id`         | Удалить                                           |

### KP

| Метод  | Путь                    | Описание                                                    |
|--------|-------------------------|-------------------------------------------------------------|
| GET    | `/api/kp`               | Список всех КП (новые первые)                               |
| GET    | `/api/kp/:id`           | Одно КП                                                     |
| POST   | `/api/kp`               | Создать КП (обычно пустой черновик)                         |
| PUT    | `/api/kp/:id`           | Сохранить КП целиком                                        |
| DELETE | `/api/kp/:id`           | Удалить КП                                                  |
| POST   | `/api/kp/:id/duplicate` | Дублировать: новый `_id`, номер, статус `draft`, «Копия —» |

### Counterparties

| Метод  | Путь                       | Описание                                      |
|--------|----------------------------|-----------------------------------------------|
| GET    | `/api/counterparties/lookup`  | `?inn=` → поиск в DaData, возвращает данные для автозаполнения |
| GET    | `/api/counterparties`      | Список. Фильтры: `?role=client&status=active&q=` |
| GET    | `/api/counterparties/:id`  | Один контрагент                               |
| POST   | `/api/counterparties`      | Создать                                       |
| PUT    | `/api/counterparties/:id`  | Обновить                                      |
| DELETE | `/api/counterparties/:id`  | Удалить                                       |

### Dictionaries

| Метод  | Путь                     | Описание                              |
|--------|--------------------------|---------------------------------------|
| GET    | `/api/dictionaries`      | Список. Фильтр: `?type=category`      |
| POST   | `/api/dictionaries`      | Создать запись                        |
| PUT    | `/api/dictionaries/:id`  | Обновить                              |
| DELETE | `/api/dictionaries/:id`  | Удалить                               |

---

## 5. КЛЮЧЕВЫЕ ФУНКЦИИ

| Функция | Как работает |
|---------|-------------|
| **Health check** | `GET /health` → `{ status: 'ok', uptime }` — публичный эндпоинт для мониторинга и deploy.sh |
| **Rate limiting** | Login endpoint: не более 10 попыток за 15 минут с одного IP (in-memory Map) |
| **Авторизация** | JWT 7 дней, bcrypt пароли. Interceptor добавляет токен к каждому запросу. При 401 — автоматический logout |
| **Создать КП** | POST /api/kp → черновик → редирект в редактор |
| **Список КП** | Карточки с номером, клиентом, суммой с НДС, статусом (Badge), датой |
| **Дублировать КП** | Кнопка ⎘ → POST /api/kp/:id/duplicate → новый черновик «Копия —» → редирект |
| **Редактор КП** | Split-layout: сайдбар (получатель + каталог + состав) + превью A4 |
| **Выбор контрагента** | Select из справочника → автозаполнение всех полей получателя (снимок) |
| **Поиск по ИНН (DaData)** | Поле ИНН + кнопка 🔍 в сайдбаре builder → `GET /api/counterparties/lookup?inn=` → DaData API → автозаполнение всех полей получателя (название, КПП, ОГРН, адрес, ФИО для ИП) |
| **Добавить товар в КП** | Клик "+" → иммутабельный update signal → computed пересчитывает превью и итоги |
| **Автосохранение** | Debounce 2 сек после любого изменения → PUT /api/kp/:id. Статус: ✓/⏳/●/✕ |
| **Ручное сохранение** | Немедленно, сбрасывает debounce |
| **Предупреждение при уходе** | CanDeactivate guard — confirm() если есть несохранённые изменения |
| **Статус КП** | Select: draft → sent → accepted/rejected |
| **Печать / PDF** | `window.print()`, `.no-print` скрыты через `@media print` |
| **Многостраничность** | KpDocumentComponent разбивает items по 10, стр.1 — шапка, последняя — итоги |
| **Каталог товаров** | CRUD, поиск по name/code/description, фильтр по категории, вид сетка/таблица |
| **Форма товара** | Артикул, тип (ITEM/SERVICE/WORK), категория с datalist, себестоимость, управление фото (добавить/удалить/сделать главным) |
| **Справочники** | Dictionary — категории и единицы из БД + уникальные из товаров |
| **Деплой** | `bash deploy/deploy.sh` — git pull + docker build + up + health check |

---

## 6. ФРОНТЕНД

### Страницы и маршруты

| URL         | Компонент            | Тип   | Guard         | Описание              |
|-------------|----------------------|-------|---------------|-----------------------|
| `/login`    | `LoginComponent`     | Smart | —             | Форма входа           |
| `/`         | `HomeComponent`      | Smart | `authGuard`   | Список КП             |
| `/products` | `ProductsComponent`  | Smart | `authGuard`   | Каталог товаров       |
| `/kp/:id`   | `KpBuilderComponent` | Smart | `authGuard` + `canDeactivate` | Редактор КП |

Защищённые маршруты обёрнуты в `AppShellComponent` (шапка + навигация + кнопка выхода).

### Состояние (Signals)

```
AuthService (singleton)
  _token  = signal<string|null>(localStorage 'kp_token')
  _user   = signal<AuthUser|null>(localStorage 'kp_user')  ← восстанавливается мгновенно
  isAuthenticated = computed(...)
  currentUser     = computed(...)
  // При старте: фоновый GET /api/me для актуализации; если токен истёк — clearToken()

HomeComponent
  kpList      = signal<Kp[]>([])
  loading     = signal(true)
  error       = signal('')          ← новый: ошибки загрузки/создания/удаления
  duplicating = signal<string|null>(null)

ProductsComponent
  products       = signal<Product[]>([])
  search         = signal('')
  filterCategory = signal('')
  view           = signal<'grid'|'table'>('grid')
  categories     = signal<string[]>([])
  filtered       = computed(...)  ← products + search + filterCategory

KpBuilderComponent
  kp             = signal<Kp|null>(null)
  products       = signal<Product[]>([])
  counterparties = signal<Counterparty[]>([])
  loading        = signal(true)
  innQuery       = ''                        ← строка для поиска по ИНН
  lookingUp      = signal(false)             ← флаг запроса к DaData
  lookupError    = signal('')               ← ошибка поиска
  catalogItems   = computed(...)
  subtotal       = computed(...)
  vatAmount      = computed(...)
  total          = computed(...)
  isDirty        = computed(() => autosave.status === 'unsaved')

AutosaveService (scoped к KpBuilderComponent)
  status: SaveStatus  ← 'saved'|'saving'|'unsaved'|'error'
```

### Компоненты документа A4 (все Dumb)

```
KpDocumentComponent       ← оркестратор, разбивка на страницы
  ├── KpBackgroundComponent  ← фоновое изображение
  ├── KpHeaderComponent      ← получатель (legalForm, inn, kpp, адрес...) + метаданные
  ├── KpCatalogComponent     ← таблица позиций (с колонкой Арт.)
  └── KpTableComponent       ← итоги + условия
```

---

## 7. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

| Проблема | Решение | Почему так |
|----------|---------|------------|
| `this.http` до инициализации в `ApiService` | Перенесено в `constructor` | TypeScript strict mode |
| `icon` атрибут давал TS2322 | `booleanAttribute` transform | HTML-атрибуты без значения = пустая строка |
| `InputSignal` передавался в шаблон вместо значения | `metadata()`, `totals()`, `conditions()` | Signals в шаблонах нужно вызывать как функцию |
| `KpCatalogItem.id` был `number` | Изменён на `string` | MongoDB ObjectId — строка |
| `recipient.name: required` ломало создание черновика | `default: ''` | При создании КП получатель ещё не заполнен |
| Мутация объекта внутри сигнала | Везде иммутабельные обновления | Signals сравнивают по ссылке |

---

## 8. ЧТО В РАБОТЕ / TODO

- [ ] **Страница контрагентов** `/counterparties` — CRUD UI (модель, API и lookup по ИНН готовы)
- [ ] **Страница справочников** — управление категориями, единицами измерения
- [ ] **Условия КП** — поле `conditions[]` в модели есть, UI для редактирования не реализован
- [ ] **Загрузка изображений** — сейчас только URL, нужен upload на сервер
- [ ] **Серверная нумерация КП** — сейчас `КП-${Date.now()}`, нужен инкремент
- [x] ~~**Health endpoint**~~ — `GET /health` добавлен
- [ ] **Управление пользователями** — нет UI для создания/редактирования пользователей
- [ ] **Toast/уведомления** — нет глобального компонента уведомлений об ошибках
- [ ] **Загрузка изображений** — upload файлов вместо URL (только seed:admin)

---

## 9. ДОКУМЕНТАЦИЯ

| Файл | Содержание |
|------|-----------|
| [`README.md`](./README.md) | Быстрый старт, запуск локально |
| [`docs/architecture.md`](./docs/architecture.md) | Структура, smart/dumb, реактивность, тесты |
| [`docs/business-logic.md`](./docs/business-logic.md) | Сущности, статусы, расчёты, правила редактора |
| [`docs/api.md`](./docs/api.md) | Все эндпоинты с примерами запросов/ответов |
| [`docs/ui-kit.md`](./docs/ui-kit.md) | UI kit компоненты, design tokens, примеры |
| [`docs/deploy.md`](./docs/deploy.md) | Деплой, переменные окружения, nginx, логи |

---

## 10. ИСТОРИЯ ИЗМЕНЕНИЙ

| Дата       | Изменение                                                                                   |
|------------|---------------------------------------------------------------------------------------------|
| 2026-04-20 | Инициализация: Angular + Express + MongoDB, базовый CRUD КП и товаров                      |
| 2026-04-20 | UI Kit: Button, Badge, Modal, FormField, Alert + Design Tokens                              |
| 2026-04-20 | Рефакторинг реактивности: Signals, computed, takeUntilDestroyed, иммутабельность            |
| 2026-04-20 | Деплой: Docker Compose prod, Nginx, deploy.sh                                               |
| 2026-04-20 | Тесты: ApiService, HomeComponent, ProductsComponent, Button, Badge                         |
| 2026-04-20 | Автосохранение КП: AutosaveService (debounce 2s), статус в тулбаре, CanDeactivate guard    |
| 2026-04-20 | Дублирование КП: POST /api/kp/:id/duplicate, кнопка ⎘, редирект в редактор                |
| 2026-04-20 | Авторизация: JWT, User модель, authGuard middleware, AuthService, interceptor, LoginComponent, AppShellComponent |
| 2026-04-20 | Контрагенты: модель Counterparty (российская специфика), CRUD API, интеграция в builder    |
| 2026-04-20 | Аудит и исправление 30+ проблем: try-catch во всех роутах, rate limiting на login, health endpoint, environment файлы Angular, BASE URL из env, AutosaveService status→Signal, валидация ИНН/КПП/qty в моделях, backend/.env в .gitignore, дублирование middleware логирования, email валидация на логине, обработка ошибок в HomeComponent |
| 2026-04-20 | Расширение Product: code, category, subcategory, costRub, images[], isActive, kind, notes  |
| 2026-04-20 | Dictionary: гибридный справочник категорий/единиц. KpItem + code. Фильтр по категории      |

---

## ПРАВИЛО ОБНОВЛЕНИЯ ПАСПОРТА

При каждом значимом изменении обновить:

1. Раздел **ИСТОРИЯ ИЗМЕНЕНИЙ** — добавить запись
2. Раздел **3. СУЩНОСТИ** — если изменилась схема БД
3. Раздел **4. API** — если добавлен/изменён эндпоинт
4. Раздел **5. ФУНКЦИИ** — если добавлена/изменена фича
5. Раздел **6. ФРОНТЕНД** — если новый маршрут, компонент, изменилось состояние
6. Раздел **8. TODO** — закрыть выполненные, добавить новые

**Значимые изменения:** новая фича, эндпоинт, схема БД, компонент UI kit, деплой.

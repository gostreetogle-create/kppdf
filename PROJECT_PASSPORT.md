# KP PDF — AI PROJECT PASSPORT

> **Назначение этого файла:** навигация и правила для AI. Не источник данных.
> Данные — в source of truth файлах (см. ниже).

---

## AI EXECUTION CONTRACT

### Source of Truth

| Домен | Файл-источник |
|-------|--------------|
| API эндпоинты | [`docs/api.md`](./docs/api.md) |
| Бизнес-правила, статусы, расчёты | [`docs/business-rules.md`](./docs/business-rules.md) |
| TypeScript типы | [`shared/types/`](./shared/types/) |
| UI компоненты, токены | [`docs/ui-kit.md`](./docs/ui-kit.md) |
| Деплой, окружение | [`docs/deploy.md`](./docs/deploy.md) |
| Архитектура, паттерны | [`docs/architecture.md`](./docs/architecture.md) |
| **Архитектурные решения (активный слой)** | **см. раздел ARCHITECTURAL DECISIONS ниже** |
| Этот файл | навигация + правила AI (не данные) |

### Запрещено

- Переопределять схемы моделей в паспорте
- Дублировать API эндпоинты из `api.md`
- Дублировать бизнес-правила из `business-rules.md`
- Мутировать `shared/types/` на стороне фронтенда (только читать)

### Обязательно перед любым изменением

```
1. Найти затронутый модуль → раздел FILE OWNERSHIP MAP
2. Открыть source of truth файл для этого домена
3. Изменить ТОЛЬКО нужный слой
4. Синхронизировать зависимые слои → раздел CHANGE IMPACT
5. Обновить паспорт ТОЛЬКО если изменилась структура/навигация
```

### Режим работы AI

- Минимальный diff — не рефакторить без запроса
- Не предполагать отсутствующие поля — проверять source of truth
- Всегда трассировать цепочку зависимостей перед изменением
- try-catch в каждом роуте бэкенда
- takeUntilDestroyed() на каждой подписке фронтенда
- Иммутабельные обновления сигналов

---

## FILE OWNERSHIP MAP

| Домен | Файлы |
|-------|-------|
| Авторизация (бэк) | `backend/src/routes/auth.routes.ts`, `backend/src/middleware/auth.middleware.ts` |
| Настройки системы | `backend/src/routes/settings.routes.ts`, `backend/src/models/settings.model.ts`, `features/settings/` |
| Авторизация (фронт) | `auth.service.ts` (initAuth), `auth.interceptor.ts`, `auth.guard.ts`, `login.component.ts`, `app.config.ts` (APP_INITIALIZER) |
| КП система | `backend/src/routes/kp.routes.ts`, `kp-builder.component.*`, `autosave.service.ts` |
| Документ A4 | `kp-document/`, `kp-background/`, `kp-header/`, `kp-catalog/`, `kp-table/` |
| Товары | `backend/src/routes/product.routes.ts`, `products.component.*`, `product-form/`, `product-card/` |
| Контрагенты | `backend/src/routes/counterparty.routes.ts`, `kp-builder.component.ts` (lookup) |
| Справочники | `backend/src/routes/dictionary.routes.ts`, `backend/src/models/dictionary.model.ts` |
| HTTP клиент | `frontend/src/app/core/services/api.service.ts` — единственный HTTP-сервис |
| Уведомления | `notification.service.ts`, `core/components/toast/` |
| UI Kit | `frontend/src/app/shared/ui/` + `docs/ui-kit.md` |
| Стили/токены | `frontend/src/styles/_tokens.scss`, `_global.scss` |
| Env переменные | `frontend/src/environments/environment*.ts`, `backend/.env` |
| Деплой | `deploy/deploy.sh`, `deploy/docker-compose.prod.yml`, `deploy/nginx.conf` |
| Seed данные | `backend/src/scripts/seed-admin.ts`, `seed-demo.ts` |

---

## QUICK START

```bash
docker-compose up -d                 # MongoDB :27017
cd backend && npm run dev            # API :3000
cd frontend && npm start             # SPA :4200
cd backend && npm run seed:demo      # тестовые данные
```

**Первый пользователь:** `admin@example.com` / `admin123`

---

## REPOSITORY MAP

```
kppdf/
├── backend/src/
│   ├── app.ts              ← точка входа, middleware, роуты
│   ├── middleware/          ← auth.middleware.ts
│   ├── models/              ← user, product, kp, counterparty, dictionary, settings
│   ├── routes/              ← auth, product, kp, counterparty, dictionary, settings
│   └── scripts/             ← seed-admin.ts, seed-demo.ts
├── frontend/src/
│   ├── environments/        ← environment.ts, environment.prod.ts
│   ├── styles/              ← _tokens.scss, _global.scss
│   └── app/
│       ├── app.routes.ts    ← маршруты + guards
│       ├── app.config.ts    ← providers
│       ├── core/            ← services/, guards/, interceptors/, components/
│       ├── features/        ← auth/, home/, products/, kp/, settings/
│       └── shared/ui/       ← button, badge, modal, form-field, alert
├── shared/types/            ← User.ts, Product.ts, Kp.ts, Counterparty.ts, ApiResponses.ts
├── deploy/                  ← docker-compose.prod.yml, Dockerfiles, nginx.conf, deploy.sh
├── docs/                    ← api.md, business-rules.md, ui-kit.md, deploy.md, architecture.md
└── docker-compose.yml       ← MongoDB локально
```

---

## SYSTEM FLOWS

### Авторизация (session restore)
```
APP_INITIALIZER → authService.initAuth() → блокирует роутинг до завершения
  если token в localStorage:
    GET /api/auth/me (с прямым Bearer заголовком, без interceptor)
    OK  → _user.set(), _initialized.set(true) → роутинг разблокирован
    401 → clearToken(), _initialized.set(true) → redirect /login
  если токена нет:
    _initialized.set(true) → redirect /login

authGuard: проверяет initialized() перед isAuthenticated()
  → нет мигания login→home→login
  → нет двойного запроса /me
login → POST /api/auth/login → token → localStorage['kp_token', 'kp_user']
authInterceptor → Bearer token на каждый запрос
401 → logout → /login
```

### Редактор КП
```
HomeComponent → POST /api/kp → /kp/:id
KpBuilderComponent: GET kp + products + counterparties
Изменение → kp.set({...}) → effect() → AutosaveService → debounce 2s → PUT /api/kp/:id
Поиск по ИНН → GET /api/counterparties/lookup?inn= → DaData → recipient
```

### Добавление товара в КП
```
addItem() → kp.set({...items}) → effect() → autosave
computed(catalogItems/subtotal/vatAmount/total) → KpDocumentComponent → A4 preview
⚠️ effect() защищён флагом initialized — без него PUT при первой загрузке
```

---

## CHANGE IMPACT

| Изменение | Затронутые файлы |
|-----------|-----------------|
| Модель Product | `product.model.ts` → `shared/types/Product.ts` → `api.service.ts` → `product-form` → `product-card` |
| Модель Kp | `kp.model.ts` → `shared/types/Kp.ts` → `api.service.ts` → `kp-builder` → все `kp-*` |
| KpItem поля | `kp.model.ts` → `kp-catalog.component.ts` (KpCatalogItem) → `kp-builder` (catalogItems) |
| Counterparty | `counterparty.model.ts` → `shared/types/Counterparty.ts` → `kp-header` (KpRecipient) |
| Auth | `auth.routes.ts` → `auth.middleware.ts` → `auth.service.ts` → `auth.interceptor.ts` |
| UI Kit | `shared/ui/<component>` → `index.ts` → все использующие |
| Токены | `_tokens.scss` → все `.scss` с `@use 'tokens'` |
| API URL | `environments/environment*.ts` |

---

## SAFE CHANGE RULES

**Нельзя трогать без понимания последствий:**
- `KpItem` структура — данные в MongoDB, нет миграций
- `localStorage` ключи `kp_token`, `kp_user` — смена разлогинит всех
- `AutosaveService` trigger$ + switchMap — нарушение = дублирующие PUT
- `KpDocumentComponent` inputs — используется для печати A4

---

## ROUTES

| URL | Компонент | Guard |
|-----|-----------|-------|
| `/login` | `LoginComponent` | — |
| `/` | `HomeComponent` | `authGuard` |
| `/products` | `ProductsComponent` | `authGuard` |
| `/kp/:id` | `KpBuilderComponent` | `authGuard` + `canDeactivate` |

Все защищённые маршруты — дочерние к `AppShellComponent`.

---

## ARCHITECTURAL DECISIONS (AI-ACTIVE LAYER)

> Источник истины для генерации и рефакторинга кода. Все изменения выполняются строго по нему.

### 1. COMPANY MODEL
`Counterparty` — единая сущность для клиентов, поставщиков и нашей компании.  
Новые поля: `isOurCompany: boolean`, `backgrounds: { page1: string, page2: string }`, `footerText: string`  
Правило: `isOurCompany = true` → это Company. В системе только 1 активная Company.  
`isOurCompany = false` по умолчанию — существующие данные не ломаются.

### 2. IMAGE SYSTEM
```
images: { url: string, isMain: boolean, sortOrder: number,
          context: 'product' | 'kp-page1' | 'kp-page2' | 'passport' }
```
Одна структура для всех сущностей. Фильтрация через `context`. `isMain` — только внутри `context`.

### 3. SETTINGS SYSTEM
Коллекция `Settings`: `{ key: string, value: any, label: string }`  
Ключи: `kp_validity_days`, `kp_prepayment_percent`, `kp_vat_percent`, `kp_production_days`  
**Settings = DEFAULT SOURCE OF CONFIGURATION.** Counterparty/Company может переопределять.

### 4. KP FOOTER
Источник: `Counterparty.footerText` (HTML).  
Отображается только на последней странице КП, после `KpTableComponent`, не перекрывает таблицу.

### 5. COMPANY SELECTION
`isOurCompany = true` выбирается автоматически при создании КП. Можно сменить вручную в builder.

### 6. QUICK PRODUCT CREATION
Из KP Builder → мини-форма (name, price, unit) → `POST /api/products` → сразу в таблице КП.

### 7. PRIORITY RULES
`Settings` (глобально) → `Counterparty/Company` → `Product defaults` → `UI overrides`

### 8. NON-BREAKING RULES
- Не менять структуру `Counterparty` без миграции
- Не удалять `images[]` систему
- Не дублировать `Settings` в других таблицах

---

## KNOWN ISSUES

| Проблема | Приоритет |
|----------|-----------|
| Нет страницы контрагентов (модель + API готовы) | High |
| Нет проверки ролей admin/manager на бэке и фронте | Medium |
| Нет ограничений редактирования по статусу КП | Medium |
| Нет страницы справочников | Medium |
| Условия КП — поле есть, UI нет | Medium |
| Нет upload изображений (только URL) | Medium |
| shared/types не импортируются бэком | Medium |
| Rate limiting in-memory (сбрасывается при рестарте) | Medium |
| Нет refresh токенов | Low |
| Нумерация КП через Date.now() | Low |
| KP builder: выбор компании, footer, быстрое добавление товара — не реализованы | High |
| Страница /settings создана, но не подключена к builder (дефолты КП) | Medium |

---

## CHANGELOG

| Дата | Изменение |
|------|-----------|
| 2026-04-20 | Инициализация: Angular + Express + MongoDB, CRUD КП и товаров |
| 2026-04-20 | UI Kit: Button, Badge, Modal, FormField, Alert + Design Tokens |
| 2026-04-20 | Реактивность: Signals, computed, takeUntilDestroyed, иммутабельность |
| 2026-04-20 | Деплой: Docker Compose prod, Nginx, deploy.sh |
| 2026-04-20 | Автосохранение КП: AutosaveService debounce 2s, CanDeactivate guard |
| 2026-04-20 | Дублирование КП: POST /api/kp/:id/duplicate |
| 2026-04-20 | Авторизация: JWT, User, authGuard, interceptor, LoginComponent, AppShell |
| 2026-04-20 | Контрагенты: Counterparty модель, CRUD API |
| 2026-04-20 | Product: code, category, images[], isActive, kind, costRub, notes |
| 2026-04-20 | Dictionary: гибридный справочник, KpItem + code |
| 2026-04-20 | DaData: lookup по ИНН → автозаполнение получателя |
| 2026-04-20 | Аудит: try-catch, rate limiting, health endpoint, environment файлы |
| 2026-04-20 | AuthService: персистентность через localStorage |
| 2026-04-20 | APP_INITIALIZER: authService.initAuth() блокирует роутинг до проверки токена; authGuard ждёт initialized(); нет мигания login→home |
| 2026-04-20 | Settings: модель + API (GET/PUT /api/settings), страница /settings, дефолты КП из БД |
| 2026-04-20 | Counterparty расширен: isOurCompany, images[] с context, footerText |
| 2026-04-20 | Kp расширен: companyId, дефолты из Settings при создании |
| 2026-04-20 | ProductImage расширен: поле context (product/kp-page1/kp-page2/passport) |
| 2026-04-20 | GET /api/counterparties/company — эндпоинт нашей компании |
| 2026-04-21 | Settings: модель + API + страница /settings, дефолты КП из БД |
| 2026-04-21 | Counterparty расширен: isOurCompany, images[] с context, footerText |
| 2026-04-21 | Kp расширен: companyId, дефолты из Settings при создании |
| 2026-04-21 | ProductImage: context optional, factory createImage(), синхронизирован shared/types |
| 2026-04-21 | APP_INITIALIZER: authReady gate, нет мигания login→home |
| 2026-04-21 | Bootstrap loading screen пока authReady=false |
| 2026-04-21 | Print fix: @page A4, шапка скрыта, фон cover, builder layout при печати |
| 2026-04-21 | DTO audit: Counterparty в api.service.ts дополнен company-полями |
| 2026-04-20 | Документация: Single Source of Truth, удалены дубли |
| 2026-04-20 | Паспорт: рефакторинг до навигационного слоя (AI Execution Contract) |

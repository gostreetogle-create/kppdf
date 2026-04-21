# KP PDF — AI PROJECT PASSPORT

> **Назначение:** системная карта + правила мышления для AI-агентов.
> Не источник данных — источник навигации и решений.

---

## 🧠 AI THINKING MODE (читать первым)

Перед любым изменением:

```
1. Определи домен: Kp | Product | Counterparty | Auth | Settings | UI
2. Найди Source of Truth файл (таблица ниже)
3. Проверь CHANGE IMPACT (раздел ниже)
4. Проверь ARCHITECTURAL DECISIONS
5. Убедись что изменение НЕ ломает snapshot-логику КП
```

**Правило данных:**
- `Counterparty` = source of truth для клиентов/поставщиков/компании
- `Kp.recipient` = immutable snapshot (не live reference!)
- `Settings` = global configuration layer
- `UI` = presentation only, не хранит бизнес-истину

**При неопределённости:** не угадывай → проверь source of truth → если нет, предложи уточнение.

**Финальное правило:** "Не оптимизируй то, что ещё не доказано проблемой"

---

## SOURCE OF TRUTH MAP

| Домен | Source of Truth | Детали |
|-------|----------------|--------|
| API контракты | [`docs/api.md`](./docs/api.md) | Все эндпоинты с примерами |
| Бизнес-правила | [`docs/business-rules.md`](./docs/business-rules.md) | Статусы, расчёты, роли |
| TypeScript типы | [`shared/types/`](./shared/types/) | Canonical interfaces |
| UI компоненты | [`docs/ui-kit.md`](./docs/ui-kit.md) | Kit + токены |
| Деплой | [`docs/deploy.md`](./docs/deploy.md) | Docker, nginx, env |
| Архитектурные решения | раздел ARCHITECTURAL DECISIONS ниже | Активный слой |

---

## ПРИОРИТЕТЫ СИСТЕМЫ

```
1. Безопасность данных (KP snapshot не ломается)
2. Консистентность типов (shared/types ↔ backend ↔ frontend)
3. Совместимость API (backward compatible)
4. UI улучшения
5. Рефакторинг (только если явно запрошен)
```

---

## ЗАПРЕЩЕНО

- Изменять `shared/types/` без синхронизации backend
- Превращать `Kp.recipient` (snapshot) в live reference на Counterparty
- Дублировать данные между слоями
- Делать рефакторинг без прямого запроса
- Менять API контракт без обновления `docs/api.md`
- Изменять несколько доменов в одном pass

---

## ARCHITECTURAL DECISIONS (активный слой)

### Company Model
`Counterparty` — единая сущность для клиентов, поставщиков и нашей компании.
- `isOurCompany: boolean` — наша компания (только 1 активная)
- `images: IImage[]` — фоны КП (context: kp-page1/kp-page2/passport)
- `footerText: string` — HTML текст внизу последней страницы КП
- `isOurCompany = false` по умолчанию — существующие данные не ломаются

### Image System
```typescript
// Единая структура для всех сущностей
{ url, isMain, sortOrder, context?: 'product'|'kp-page1'|'kp-page2'|'passport' }
// context optional, default: 'product'
// Создавать ТОЛЬКО через factory:
createImage(url, { context: 'product' })
```

### Settings System
Коллекция `Settings`: `{ key, value, label }`
Ключи: `kp_validity_days`, `kp_prepayment_percent`, `kp_production_days`, `kp_vat_percent`
**Settings = DEFAULT SOURCE OF CONFIGURATION.** Переопределяется на уровне Company.

### KP Snapshot Rule
`Kp.recipient` — снимок данных контрагента на момент создания КП.
Изменение `Counterparty` НЕ влияет на существующие КП. Это намеренно.

### Auth Bootstrap
`APP_INITIALIZER → authService.initAuth()` блокирует роутинг до проверки токена.
`authReady = signal(false)` → guard ждёт `authReady = true`.

---

## CHANGE IMPACT MATRIX

| Что меняем | Затронутые файлы |
|-----------|-----------------|
| `Product` schema | `product.model.ts` → `shared/types/Product.ts` → `api.service.ts` → `product-form` → `product-card` |
| `Kp` schema | `kp.model.ts` → `shared/types/Kp.ts` → `api.service.ts` → `kp-builder` → все `kp-*` |
| `KpItem` поля | `kp.model.ts` → `kp-catalog.component.ts` (KpCatalogItem) → `kp-builder` (catalogItems) |
| `Counterparty` schema | `counterparty.model.ts` → `shared/types/Counterparty.ts` → `api.service.ts` → `kp-header` (KpRecipient) |
| `Settings` keys | `settings.model.ts` → `kp.routes.ts` (defaults) → `settings.component.ts` → `api.service.ts` |
| Auth flow | `auth.routes.ts` → `auth.middleware.ts` → `auth.service.ts` → `auth.interceptor.ts` → `app.config.ts` |
| UI Kit компонент | `shared/ui/<component>` → `index.ts` → все использующие |
| Design tokens | `_tokens.scss` → все `.scss` с `@use 'tokens'` |
| API Base URL | `environments/environment*.ts` |

---

## QUICK START

```bash
docker-compose up -d                 # MongoDB :27017
cd backend && npm run dev            # API :3000
cd frontend && npm start             # SPA :4200
cd backend && npm run seed:demo      # 20 товаров + 5 контрагентов + 7 КП + admin
```
Вход: `admin@example.com` / `admin123`

---

## REPOSITORY MAP

```
kppdf/
├── backend/src/
│   ├── app.ts              ← точка входа
│   ├── middleware/          ← auth.middleware.ts
│   ├── models/              ← user, product, kp, counterparty, dictionary, settings
│   ├── routes/              ← auth, product, kp, counterparty, dictionary, settings
│   └── scripts/             ← seed-admin.ts, seed-demo.ts
├── frontend/src/
│   ├── environments/        ← environment.ts, environment.prod.ts
│   ├── styles/              ← _tokens.scss, _global.scss
│   └── app/
│       ├── app.routes.ts    ← маршруты + guards
│       ├── app.config.ts    ← providers + APP_INITIALIZER
│       ├── core/            ← services/, guards/, interceptors/, components/
│       ├── features/        ← auth/, home/, products/, kp/, settings/, counterparties/
│       └── shared/ui/       ← button, badge, modal, form-field, alert
├── shared/types/            ← canonical TypeScript interfaces
├── deploy/                  ← docker-compose.prod.yml, Dockerfiles, nginx, deploy.sh
├── docs/                    ← api.md, business-rules.md, ui-kit.md, deploy.md
└── docker-compose.yml       ← MongoDB локально
```

---

## SYSTEM FLOWS

### Auth (bootstrap)
```
APP_INITIALIZER → initAuth()
  token в localStorage? → GET /api/auth/me
    OK  → authReady=true, user восстановлен
    401 → clearToken(), authReady=true → /login
  нет токена → authReady=true → /login
authGuard: ждёт authReady(), затем проверяет isAuthenticated()
```

### KP Editor
```
HomeComponent → POST /api/kp (дефолты из Settings) → /kp/:id
KpBuilderComponent: GET kp + products + counterparties
Изменение → kp.set({...}) → effect() → AutosaveService → debounce 2s → PUT /api/kp/:id
Поиск по ИНН → GET /api/counterparties/lookup?inn= → DaData → recipient (snapshot)
```

---

## FILE OWNERSHIP MAP

| Домен | Файлы |
|-------|-------|
| Auth (бэк) | `auth.routes.ts`, `auth.middleware.ts` |
| Auth (фронт) | `auth.service.ts`, `auth.interceptor.ts`, `auth.guard.ts`, `app.config.ts` |
| КП система | `kp.routes.ts`, `kp-builder.component.*`, `autosave.service.ts` |
| Документ A4 | `kp-document/`, `kp-background/`, `kp-header/`, `kp-catalog/`, `kp-table/` |
| Товары | `product.routes.ts`, `products.component.*`, `product-form/`, `product-card/` |
| Контрагенты | `counterparty.routes.ts`, `kp-builder.component.ts` (lookup + fillFrom), `features/counterparties/` |
| Настройки | `settings.routes.ts`, `settings.model.ts`, `features/settings/` |
| HTTP клиент | `api.service.ts` — единственный HTTP-сервис |
| Уведомления | `notification.service.ts`, `core/components/toast/` |
| UI Kit | `shared/ui/` + `docs/ui-kit.md` |
| Shared типы | `shared/types/` — canonical, не дублировать |

---

## ROUTES

| URL | Компонент | Guard |
|-----|-----------|-------|
| `/login` | `LoginComponent` | — |
| `/` | `HomeComponent` | `authGuard` |
| `/products` | `ProductsComponent` | `authGuard` |
| `/counterparties` | `CounterpartiesComponent` | `authGuard` |
| `/kp/:id` | `KpBuilderComponent` | `authGuard` + `canDeactivate` |
| `/settings` | `SettingsComponent` | `authGuard` |

---

## KNOWN ISSUES (по приоритету)

| # | Проблема | Приоритет |
|---|----------|-----------|
| ~~1~~ | ~~Нет страницы контрагентов — CRUD UI (модель + API готовы)~~ | ✅ Готово || 2 | Нет проверки ролей admin/manager на бэке и фронте | 🟠 Medium |
| 3 | Нет ограничений редактирования КП по статусу (sent/accepted = readonly) | 🟠 Medium |
| 4 | Нет страницы справочников (Dictionary CRUD UI) | 🟠 Medium |
| 5 | Условия КП — `conditions[]` есть в модели, UI нет | 🟠 Medium |
| 6 | Нет upload изображений (только URL) | 🟠 Medium |
| 7 | `shared/types/` не импортируются бэком (только фронт) | 🟡 Low |
| 8 | Rate limiting in-memory (сбрасывается при рестарте) | 🟡 Low |
| 9 | Нумерация КП через `Date.now()` | 🟡 Low |
| 10 | Нет refresh токенов | 🟡 Low |

---

## CHANGELOG

| Дата | Изменение |
|------|-----------|
| 2026-04-20 | Инициализация: Angular + Express + MongoDB, CRUD КП и товаров |
| 2026-04-20 | UI Kit, Design Tokens, Signals рефакторинг, деплой |
| 2026-04-20 | Авторизация: JWT, authGuard, interceptor, AppShell |
| 2026-04-20 | Контрагенты: Counterparty модель, CRUD API, DaData lookup |
| 2026-04-20 | Product: code, category, images[], isActive, kind, Dictionary |
| 2026-04-20 | Автосохранение КП, дублирование КП, CanDeactivate guard |
| 2026-04-21 | Settings: модель + API + страница /settings, дефолты КП из БД |
| 2026-04-21 | Counterparty: isOurCompany, images[] с context, footerText |
| 2026-04-21 | Kp: companyId, дефолты из Settings при создании |
| 2026-04-21 | ProductImage: context optional, factory createImage() |
| 2026-04-21 | APP_INITIALIZER: authReady gate, bootstrap loading screen |
| 2026-04-21 | Print fix: @page A4, шапка скрыта, builder layout при печати |
| 2026-04-21 | shared/types: canonical interfaces + алиасы для frontend |
| 2026-04-21 | Паспорт: AI Thinking Mode, приоритеты, KNOWN ISSUES по приоритету |
| 2026-04-21 | Sprint 1: Counterparties CRUD (list, create/edit, delete, DaData lookup, search/filter), Admin sidebar layout migration |
| 2026-04-21 | CpRole расширен: добавлена роль `company` (наша компания, создаёт КП). Обновлены: Mongoose enum, shared/types, api.service.ts, форма и таблица контрагентов |

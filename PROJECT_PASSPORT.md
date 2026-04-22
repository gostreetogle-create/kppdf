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

**Документационная дисциплина (обязательно):**
- после каждого значимого изменения кода синхронизировать `PROJECT_PASSPORT.md` и профильные `docs/*` в этом же pass;
- не оставлять рассинхрон "код обновлён, docs потом".

---

## SOURCE OF TRUTH MAP

| Домен | Source of Truth | Детали |
|-------|----------------|--------|
| API контракты | [`docs/api.md`](./docs/api.md) | Все эндпоинты с примерами |
| Бизнес-правила | [`docs/business-rules.md`](./docs/business-rules.md) | Статусы, расчёты, роли |
| TypeScript типы | [`shared/types/`](./shared/types/) | Canonical interfaces |
| UI компоненты | [`docs/ui-kit.md`](./docs/ui-kit.md) | Kit + токены |
| Деплой | [`docs/deploy.md`](./docs/deploy.md) | systemd, nginx, env |
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
JSON-операции (импорт/экспорт товаров и контрагентов) выполняются централизованно через страницу `Settings`.
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
| Bulk import контрагентов | `counterparty.routes.ts` (POST /bulk) → `api.service.ts` → `counterparties.component.ts` |
| `Settings` keys | `settings.model.ts` → `kp.routes.ts` (defaults) → `settings.component.ts` → `api.service.ts` |
| Bulk import товаров | `product.routes.ts` (POST /bulk) → `api.service.ts` → `products.component.ts` |
| Auth flow | `auth.routes.ts` → `auth.middleware.ts` → `auth.service.ts` → `auth.interceptor.ts` → `app.config.ts` |
| UI Kit компонент | `shared/ui/<component>` → `index.ts` → все использующие |
| Design tokens | `_tokens.scss` → все `.scss` с `@use 'tokens'` |
| API Base URL | `environments/environment*.ts` |

---

## QUICK START

```bash
sudo systemctl start mongod          # MongoDB :27017
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
│   └── scripts/             ← seed-admin.ts, seed-demo.ts, seed-products.ts
├── frontend/src/
│   ├── environments/        ← environment.ts, environment.prod.ts
│   ├── styles/              ← _tokens.scss, _global.scss
│   └── app/
│       ├── app.routes.ts    ← маршруты + guards
│       ├── app.config.ts    ← providers + APP_INITIALIZER
│       ├── core/            ← services/, guards/, interceptors/, components/
│       ├── features/        ← auth/, home/, products/, kp/, settings/, counterparties/
│       └── shared/          ← ui/ (kit), components/ (counterparty-form для КП + справочника)
├── shared/types/            ← canonical TypeScript interfaces
├── deploy/                  ← deploy.sh + .env.example (prod без Docker)
├── docs/                    ← api.md, business-rules.md, ui-kit.md, deploy.md
└── docker-compose.yml       ← MongoDB локально (опционально)
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
KpBuilderComponent: forkJoin(GET kp + GET counterparties), отдельно GET products
Изменение → kp.set({...}) → effect() → AutosaveService → debounce 2s → PUT /api/kp/:id (стартует после первой добавленной позиции товара)
Поиск по ИНН → GET /api/counterparties/lookup?inn= → DaData → recipient (snapshot)
Новый получатель: «+» → модалка `CounterpartyFormComponent` на странице КП → POST контрагент → в список сайдбара + snapshot `recipient`; уход со страницы при dirty → `canDeactivateBuilder` → ответ через `ui-modal` (не `window.confirm`). Опционально URL `?selectCp=` при внешнем переходе всё ещё обрабатывается после forkJoin загрузки
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
| Контрагенты | `counterparty.routes.ts`, `kp-builder.component.ts` (lookup + fillFrom), `features/counterparties/`, `shared/components/counterparty-form/` (форма справочника + КП) |
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
| ~~1~~ | ~~Нет страницы контрагентов — CRUD UI (модель + API готовы)~~ | ✅ Готово |
| ~~2~~ | ~~Нет проверки ролей admin/manager на бэке и фронте~~ | ✅ Готово |
| ~~3~~ | ~~Нет ограничений редактирования КП по статусу (sent/accepted = readonly)~~ | ✅ Готово |
| ~~4~~ | ~~Нет страницы справочников (Dictionary CRUD UI)~~ | ✅ Готово |
| ~~5~~ | ~~Условия КП — `conditions[]` отображаются в документе, но нет UI для редактирования в builder~~ | ✅ Готово |
| 6 | Нет upload изображений (только URL) | 🟠 Medium |
| 7 | `shared/types/` не импортируются бэком (только фронт) | 🟡 Low |
| 8 | Rate limiting in-memory (сбрасывается при рестарте) | 🟡 Low |
| ~~9~~ | ~~Нумерация КП через `Date.now()`~~ | ✅ Готово |
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
| 2026-04-21 | Sprint 1 завершён: CounterpartyFormComponent (dumb) — все поля, валидация, DaData lookup, create/edit режимы |
| 2026-04-21 | Bulk import товаров: POST /api/products/bulk (skip/update режимы), seed-products.ts, UI кнопка "Импорт JSON" в ProductsComponent |
| 2026-04-21 | Документация синхронизирована с кодом: API bulk import/company route, архитектурные маршруты и бизнес-правила роли `company` |
| 2026-04-21 | KP Builder: readonly режим для статусов `sent/accepted`, UI редактирования `conditions[]` (добавить/изменить/удалить) |
| 2026-04-21 | Dictionaries: добавлена страница `/dictionaries` (CRUD справочников), маршрут и пункт в сайдбаре |
| 2026-04-21 | Auth roles: backend `requireRole`, admin-only routes (`/settings`, `/dictionaries`), ограничение перехода статуса KPI для manager (`draft→sent`) + frontend adminGuard/скрытие пунктов |
| 2026-04-21 | KP Builder UX pass: collapsible-секции, focus-mode каталога, поиск/фильтр товаров, stepper qty, undo удаления, шаблоны условий |
| 2026-04-21 | KP Builder final polish: inline-валидация реквизитов, reorder условий, lazy image в таблице, отчёт missing photos, manual regression protocol |
| 2026-04-21 | Counterparties bulk import: добавлен `POST /api/counterparties/bulk` (safe mode skip/update), в UI добавлены шаблон JSON + импорт файла с batch/fallback и отчётом ошибок |
| 2026-04-21 | JSON-функционал полностью перенесён в `/settings`: шаблоны, импорт (products/counterparties), экспорт, отчёт missing photos; кнопки на страницах товаров/контрагентов убраны |
| 2026-04-21 | KP Builder: в правой панели добавлен компактный блок «Параметры КП» с редактированием номера, срока действия, предоплаты, срока изготовления и НДС |
| 2026-04-21 | Нумерация КП унифицирована на бэкенде: новый формат `КП-YYYYMMDD-XXX` для создания и дублирования, без timestamp в номере |
| 2026-04-21 | Создание нового КП на фронте переведено на дефолты из `Settings` (убран локальный хардкод `metadata`/`vatPercent` в `HomeComponent`) |
| 2026-04-21 | KP Builder UI polish: блок «Параметры КП» приведён к единому collapsible-стилю, улучшены CTA/hover/focus у заголовков секций, повышена видимость стрелок |
| 2026-04-21 | KP Builder layout polish: превью центрировано, отключён внутренний скролл у области документа, сбалансированы ширины колонок |
| 2026-04-21 | Каталог в KP Builder доработан: карточки товаров с миниатюрой фото, артикулом и улучшенной компоновкой; расширена левая панель каталога |
| 2026-04-21 | Финальный формат нумерации КП: `КП-001`, `КП-002`... (глобальная последовательность, +1 от максимального существующего номера нового формата) |
| 2026-04-21 | Усилено правило синхронизации документации: вместе с `PROJECT_PASSPORT.md` обязательно обновляются профильные `docs/*` без отложенных правок |
| 2026-04-21 | В `Параметры КП` добавлено поле переноса таблицы: `metadata.tablePageBreakAfter` (после какой строки делать новую страницу в документе) |
| 2026-04-21 | `Состав КП` UX доработан: явная кнопка удаления у каждой позиции + ручное добавление позиции (если товар не найден в каталоге) |
| 2026-04-21 | Визуал предпросмотра KP в builder уменьшен (scale) для компактного отображения листа без центрального скролла |
| 2026-04-21 | Медиа (фото/фоны) вынесены в корневую папку `media/` (в `.gitignore`), настроен static/proxy доступ `/media` и legacy-алиасы `/products`, `/kp` для старых ссылок |
| 2026-04-21 | Печать A4 стабилизирована: при print отключается экранный scale превью, сохранён вывод 1:1 и предотвращены разрывы внутри листа |
| 2026-04-22 | KP Builder «+» получатель: общая форма в `shared/components/counterparty-form`, модалка на странице КП без навигации; загрузка КП+контрагентов `forkJoin` (в т.ч. для `?selectCp=`); `canDeactivate` — `ui-modal` вместо `window.confirm` |
| 2026-04-22 | KP Builder autosave: исключён автосейв на первом рендере; для пустого КП автосохранение включается только после первой добавленной товарной позиции |
| 2026-04-22 | Counterparty API: локализованы ошибки валидации (required/enum/match/duplicate INN) — в ответах только русские сообщения без `Counterparty validation failed` |
| 2026-04-22 | Деплой переведен на сценарий без Docker: `deploy/deploy.sh` (npm build + systemd + nginx), обновлены `deploy/.env.example`, `docs/deploy.md`, `README.md` |
| 2026-04-22 | Безопасность деплоя усилена: защита фото/медиа (`MEDIA_ROOT` не очищается), безопасное обновление статики через `rsync`, блокировка `git pull` при dirty-дереве (с флагом `--allow-dirty` для осознанного обхода) |

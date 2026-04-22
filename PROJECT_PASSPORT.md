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

**Execution Quality Gate (обязательно перед "готово"):**
- UI/Angular: если добавлен новый компонент в шаблон standalone-компонента, проверить что он добавлен в `@Component.imports`.
- UX: для диалогов/подтверждений использовать kit (`ui-modal`, toast), не использовать `window.alert/confirm/prompt`.
- Валидация: после правок обязательно выполнить `npx tsc --noEmit` в `frontend` и `backend`.
- Финальная самопроверка агента: открыть diff и проверить, что изменения соответствуют запросу пользователя без "временных" решений.

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
Бэкапы (MongoDB + media): ручной запуск, список архивов, скачивание и удаление — через `/settings` (permission `backups.manage`).
**Settings = DEFAULT SOURCE OF CONFIGURATION.** Переопределяется на уровне Company.

### KP Snapshot Rule
`Kp.recipient` — снимок данных контрагента на момент создания КП.
Изменение `Counterparty` НЕ влияет на существующие КП. Это намеренно.

### KP Item Pricing Rule
`Kp.items[].price` хранит базовую цену позиции (snapshot из каталога на момент добавления).
Для выборочных корректировок на уровне строки используются поля:
- `markupEnabled` + `markupPercent` (наценка в %),
- `discountEnabled` + `discountPercent` (скидка в %).

Эффективная цена строки рассчитывается на фронтенде при рендере/итогах:
`round(price × (1 + markup/100) × (1 - discount/100))`.

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
cd backend && npm run seed:owner     # создать владельца системы
```
Вход: `admin` / `admin123`

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
| 2026-04-22 | Исправлен nginx-шаблон в `deploy/deploy.sh`: для `/api`, `/media`, `/products`, `/kp` используется `location ^~` + единые proxy headers, чтобы медиа не ломались после очередного деплоя |
| 2026-04-22 | Settings: добавлен admin-раздел «Бэкапы» (ручной запуск backup, список архивов, поиск/фильтр, скачивание/удаление, очистка старше N дней) + API `/api/settings/backups*` |
| 2026-04-22 | Settings UX: в разделе «Бэкапы» добавлена кнопка-подсказка «Как восстановить» в `ui-modal` (копирование команд restore через сервер); дефолт очистки изменён с 7 на 30 дней |
| 2026-04-22 | Hotfix frontend: `ModalComponent` добавлен в imports `SettingsComponent`, устранена ошибка `NG8001: 'ui-modal' is not a known element` |
| 2026-04-22 | В `docs/deploy.md` добавлена постоянная prod-шпаргалка эксплуатации (deploy, health, SSL, backup/restore команды) |
| 2026-04-22 | Усилены инженерные guardrails в docs: добавлен Execution Quality Gate в паспорт, правила modal UX в `docs/ui-kit.md`, и Angular standalone DoD-checklist в `docs/architecture.md` |
| 2026-04-22 | KP Builder UX: в блоке ручного добавления позиции добавлена кнопка `+ Новый товар` (открывает форму создания товара в модалке); после сохранения товар автоматически добавляется в состав текущего КП |
| 2026-04-22 | Fix nginx routing: legacy алиасы `/products/*` и `/kp/*` ограничены файловыми URL (изображения), чтобы не перехватывать SPA-маршруты `/products` и `/kp/:id` (`Cannot GET /kp/:id`) |
| 2026-04-22 | KP Builder fallback: при ошибке загрузки `/kp/:id` (не найдено/недоступно) показывается toast и выполняется авто-редирект на главную |
| 2026-04-22 | Dev proxy fix: в `frontend/proxy.conf.json` удалены префиксные прокси `/kp` и `/products`, которые перехватывали Angular SPA-маршруты и вызывали `Cannot GET /kp/:id` локально |
| 2026-04-22 | Frontend routing fix: в `frontend/src/index.html` добавлен `<base href="/">`, устранены ошибки загрузки `styles.css/main.js` по относительному пути `/kp/*` и MIME warning |
| 2026-04-22 | KP Builder cleanup: удалены поля ручного ввода позиции из правой панели; оставлен единый сценарий добавления через `+ Новый товар` с автодобавлением в текущее КП |
| 2026-04-22 | KP Header cleanup: из шапки документа убраны поля `ОГРН` и дублирующая строка `ИП: founderName` по запросу (уменьшен визуальный шум реквизитов) |
| 2026-04-22 | KP Header fix: устранено дублирование `ИП` в названии получателя (если `shortName` уже начинается с legalForm, префикс больше не добавляется повторно) |
| 2026-04-22 | KP Builder visual: секциям сайдбара (`Получатель`, `Каталог`, `Параметры`, `Состав`, `Условия`) добавлены разные мягкие цветовые оттенки для лучшей визуальной дифференциации |
| 2026-04-22 | KP Builder visual: при раскрытии секции теперь тонируется весь блок контента (не только заголовок) через `sidebar-section--open` и цветовую тему секции |
| 2026-04-22 | KP Builder UX: секция `Состав КП` автоматически раскрывается, когда в КП появляется хотя бы один товар (добавление из каталога/нового товара/undo или загрузка существующего КП с позициями) |
| 2026-04-22 | KP table polish: уменьшены размеры колонок `№`, `Фото`, `Кол-во`, `Ед.` и миниатюр в каталоге КП для более компактного и аккуратного вида таблицы |
| 2026-04-22 | KP table visual pass: добавлены тонкие разделители числовых колонок, улучшено typographic выравнивание/контраст заголовков и сумм для более “премиального” вида таблицы |
| 2026-04-22 | KP Builder UX: стартовое состояние секций (`Получатель`, `Каталог`, `Параметры`, `Состав`, `Условия`) изменено на свернутое по умолчанию |
| 2026-04-22 | KP Builder repricing UX: в `Состав КП` добавлены фото позиций и выборочные чекбоксы `Наценка %` / `Скидка %`; расчёт итогов и таблица документа используют эффективную цену строки с учетом этих процентов |
| 2026-04-22 | KP Builder repricing UX v2: убраны per-item поля `Наценка/Скидка` из каждой карточки; добавлена массовая панель применения `%` к выбранным позициям (`Выбрать` + `Применить к выбранным` + `Сброс`) для более чистого и управляемого интерфейса |
| 2026-04-22 | KP Builder layout adaptive pass: три колонки (`лево/превью/право`) переведены на “склеенный” общий скролл и адаптивную grid-сетку с брейкпоинтами (desktop/tablet/mobile), чтобы блоки двигались согласованно и не расползались |
| 2026-04-22 | KP Builder layout fix: убран перенос правой панели вниз на средних ширинах; 3 колонки закреплены в единую строку с общим горизонтальным/вертикальным скроллом контейнера (`min-width` сетки), чтобы секции оставались “склеенными” на узких экранах |
| 2026-04-22 | KP Builder layout polish: сетка переведена на CSS-переменные ширин колонок (`--kp-left-col/--kp-right-col/--kp-preview-min`), улучшена стабильность desktop/mobile брейкпоинтов, выровнены отступы и плотность секций для цельного B2B-UI без “проседания” правой колонки |
| 2026-04-22 | KP Builder whitespace fix: уменьшены пустые поля вокруг центрального A4-превью (центральная колонка переведена на фиксированный `--kp-preview-col`, повышен scale, убраны лишние padding preview), колонки визуально “сближены” и центрированы как единый блок |
| 2026-04-22 | KP Builder layout request pass: рабочая область сдвинута вправо, колонка каталога расширена; сетка товаров в каталоге переведена на 2 карточки в ряд (с откатом в 1 колонку на узких экранах) |
| 2026-04-22 | KP Builder alignment tweak: контейнер рабочей области выровнен вправо (`justify-content: end`) и пересчитаны внутренние отступы, чтобы убрать пустое поле справа и прижать 3-колоночный блок к правому краю экрана |
| 2026-04-22 | KP Builder width rebalance: приоритет отдан каталогу товаров (левая колонка существенно расширена), при этом центральная и правая колонки сужены для устранения “пустых” зон и более плотной рабочей компоновки |
| 2026-04-22 | KP Builder adaptive width logic: для левой колонки добавлен режим `catalog-collapsed` (уменьшенная ширина при свернутом каталоге), чтобы убрать большое пустое поле; при раскрытом каталоге сохраняется расширенный режим под 2 карточки товаров в ряд |
| 2026-04-22 | Theme foundation pass: добавлен глобальный `ThemeService` (light/dark + `localStorage`), переключатель темы в `AppShell`, и базовые `--ui-*` CSS-переменные в `styles/_global.scss`; `AppShell` и ключевые стили `KP Builder` переведены на theme-aware переменные |
| 2026-04-22 | KP Builder layout-shell refactor (phase 1): введены slot-зоны `left/center/right` через grid-areas, убран `transform: scale` для preview, добавлено предсказуемое responsive-поведение (desktop 3 slots, tablet 2+1, mobile 1 колонка с порядком `center -> left -> right`) без изменения бизнес-логики |
| 2026-04-22 | KP Builder toolbar refactor (phase 2): toolbar приведен к SaaS-структуре (main/actions groups), добавлены secondary actions `Предпросмотр`, `PDF / Печать`, `Доп. действия`, status badge уплотнен; primary action `Сохранить` сохранен. Кнопки `ui-btn` переведены на `--ui-*` theme variables для light/dark консистентности |
| 2026-04-22 | KP Builder UX pass (phase 3): добавлены массовые действия `Выбрать все/Снять выделение` в составе КП и визуальная формула строки (`База → +%/-% → итог`) для прозрачного ценообразования без изменения бизнес-логики расчётов |
| 2026-04-22 | Dark mode rollout (phase 4): на `--ui-*` переменные переведены ключевые SCSS экранов `Home`, `Products` (controls/table/product-card/product-form), `Counterparties` (filters/table), `Settings`, `Dictionaries`, `Login`; повышена консистентность light/dark без изменения API и модели данных |
| 2026-04-22 | Final UI refresh polish: унифицированы theme-aware focus/disabled состояния для `ui-btn` и глобальных form controls, добавлены `--ui-canvas/--ui-success/--ui-code-*` переменные, закрыты остаточные hardcoded цвета в viewer/restore code block, и зафиксированы responsive брейкпоинты toolbar/layout для 1024/768/390 |
| 2026-04-22 | Layout system hardening (phase 1.6): глобальные layout tokens перенесены в `styles/_global.scss` (`shell/page/hero constraints`), `AppShell` sidebar width переведён на token, `KP Builder` hero width ограничен `--layout-hero-max`, и удалены локальные layout-overrides в `Dictionaries` для соблюдения единой модели экранов |
| 2026-04-22 | Component unification pass: системные классы `.search-input`, `.filter-select`, `.data-table` вынесены в `styles/_global.scss`; Products/Counterparties/Dictionaries переведены на единый token-driven слой без дублирования SCSS, добавлены semantic токены `--ui-warning` и `--ui-danger` |
| 2026-04-22 | Stabilization micro-fix pass: убран оставшийся drift поведения toolbar/filter на `Dictionaries` и `Settings/Backups` (переведены на `page-toolbar` + `.search-input/.filter-select`), выровнены semantic state-цвета в `Home` delete-hover и `KP Builder` readonly badge без изменения структуры layout/system |
| 2026-04-22 | Freeze release-gate edge-fixes: устранён mobile overflow в `Settings/Backups` и `Dictionaries` (микро-адаптив на `768/390`), а также закрыт остаточный drift token-usage в `styles/_global.scss` (`empty-state`/`loading-state` переведены на `--ui-*`) |
| 2026-04-22 | Visual premium polish pass (без архитектурных изменений): усилена typographic hierarchy (`page-header`), повышена глубина surface-layers (`data-table`, `sidebar`, `page surfaces`), перераспределён визуальный вес `ui-btn` (primary/ghost/danger), и обновлены базовые state-стили загрузки (`app.scss`) на `--ui-*` |
| 2026-04-22 | Micro visual craft pass: выполнен pixel-level polish для micro-typography/optical spacing/interaction softness (`_global`, `ui-btn`, `form-field`, `products view-toggle`, `kp-builder toolbar`) — без изменения архитектуры, layout model и component API |
| 2026-04-22 | Full autopilot visual friction cleanup: на `Home/Products/Counterparties/Settings/Dictionaries/KP Builder` снижены competing accents и UI-шум (особенно table actions, settings toolbar, builder toolbar/right panel); центр `KP Builder` сохранён как primary hero focus без изменения архитектуры и layout-system |
| 2026-04-22 | KP Builder composition fix: устранено ощущение “пустой сцены” в центре через document-frame и внутреннюю композицию (`header/main/summary` блоки в `kp-document`), уплотнена density таблицы/итогов (`kp-catalog`/`kp-table`) и слегка усилен surface contrast боковых панелей для композиционного баланса `left-center-right` |
| 2026-04-22 | KP Builder bulk-interaction fix: снятие галочки у позиции после применения массовой наценки/скидки теперь сбрасывает корректировки у этой позиции (`markup/discount`), цена строки и формула пересчитываются сразу без дополнительного действия |
| 2026-04-22 | KP Builder bulk UX simplification: убраны кнопки `Применить к выбранным`; поля `%` наценки/скидки теперь применяются к выбранным позициям в real-time при вводе, включая немедленное применение текущих значений к только что выбранной позиции |
| 2026-04-22 | KP Builder params layout tweak: блок `Параметры КП` переведён в 2 колонки на desktop; длинное поле `Перенос таблицы после строки №` расширено на всю ширину секции для лучшей читаемости |
| 2026-04-22 | KP Builder photo scale control: в `Параметры КП` добавлен параметр `Размер фото (%)` (`50..200`) с сохранением в `metadata.photoScalePercent`; размер фото в `kp-catalog` документа масштабируется динамически и применяется сразу в preview |
| 2026-04-22 | KP Builder photo scale UX polish: параметр `Размер фото (%)` переведён на интерактивный slider + numeric input; исправлена пропорциональность изменения размера фото (фиксированные `width/height` вместо `max-*`) для стабильного визуального масштаба |
| 2026-04-22 | KP Builder photo scale range updated: диапазон параметра `Размер фото (%)` изменён на `150..350`, дефолт `photoScalePercent` поднят до `150` во frontend/backend (`metadata` + schema defaults + create fallback) |
| 2026-04-22 | KP Document visual trim: горизонтальные кромки контента КП уменьшены до `5mm`; фоновые заливки в документных блоках (`kp-content main/summary`, `kp-meta`, header таблицы каталога) сделаны прозрачными по запросу |
| 2026-04-22 | KP table premium lines pass: в `kp-catalog` смягчены базовые границы таблицы (особенно вертикали), при этом сохранены чуть более заметные разделители для числовых колонок, чтобы снизить “Excel-решётку” без потери читаемости |
| 2026-04-22 | KP default page break changed: параметр `Перенос таблицы после строки №` переведён на дефолт `6` (backend schema/create fallback + frontend fallback в builder/document), чтобы новая КП сразу открывалась с более плотной пагинацией |
| 2026-04-22 | Deploy type-sync hotfix: в frontend/shared типы `KpItem`/`KpMetadata` добавлены поля `markupEnabled/markupPercent/discountEnabled/discountPercent` и `photoScalePercent`, чтобы устранить падение `ng build` на сервере (`TS2339`/`TS2353`) |
| 2026-04-22 | RBAC rollout (phase-based): внедрены роли `owner/admin/manager/viewer`, единый permission layer (`permissions.ts`, `can()`), backend guard `requirePermission`, username-only auth с `access(15m)+refresh rotation`, `mustChangePassword` gate, Users API (`/api/users*`), frontend `permissions.service` + `*appCan` + страница `/users` |

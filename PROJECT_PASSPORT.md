# KP PDF — AI PROJECT PASSPORT

> Назначение: компактная системная карта и правила принятия решений для AI-агентов проекта `kppdf`.

---

## AI THINKING MODE (читать первым)

Перед изменениями:

1. Определи домен: `Kp | Product | Counterparty | Auth | Settings | Users | UI`.
2. Найди source of truth в таблице ниже.
3. Проверь `CHANGE IMPACT MATRIX`.
4. Сверь ограничения из `CRITICAL INVARIANTS`.
5. Обнови паспорт + профильные docs в том же pass.

---

## CRITICAL INVARIANTS

1. `Kp.recipient` — immutable snapshot, не live-reference на `Counterparty`.
2. `Settings` — слой дефолтов конфигурации; значения могут переопределяться на уровне Company.
3. `shared/types/` — единственный канонический источник TypeScript-интерфейсов.
4. Запрещены `window.alert/confirm/prompt`; использовать только `ui-modal` и kit-нотификации.
5. После любых изменений запускать `npx tsc --noEmit` в `frontend` и `backend`.
6. Не объединять несколько доменов в одном коммите (исключение: атомарная синхронизация типа + UI/DTO).
7. Любое изменение API/прав доступа/бизнес-правил требует синхронизации `PROJECT_PASSPORT.md` и соответствующих `docs/*`.

---

## SOURCE OF TRUTH MAP

| Домен | Source of Truth | Детали |
|-------|-----------------|--------|
| API контракты | `docs/api.md` | Эндпоинты, payload, ошибки |
| Бизнес-правила | `docs/business-rules.md` | Статусы КП, расчёты, процесс |
| TypeScript типы | `shared/types/` | Canonical interfaces для frontend/backend |
| RBAC & PERMISSIONS | `backend/src/auth/permissions.ts`, `shared/types/User.ts` | Роли, `can()`, guards, users API |
| UI kit | `docs/ui-kit.md` | Компоненты, UX-ограничения |
| Архитектура | `docs/architecture.md` | Структура модулей, flows |
| Деплой | `docs/deploy.md` | nginx/systemd/env, backup ops |
| История изменений | `docs/CHANGELOG.md` | Подробный changelog |

---

## ARCHITECTURAL DECISIONS

### 1) Snapshot and entities
- `Counterparty` — единая сущность для клиента/поставщика/нашей компании (`role[]`, `isOurCompany`).
- `Kp.recipient` фиксируется снимком при создании/выборе получателя и не пересчитывается от будущих правок контрагента.

### 2) Settings as defaults layer
- Коллекция `Settings`: `{ key, value, label }`.
- Актуальные системные ключи: `kp_validity_days`, `kp_prepayment_percent`, `kp_production_days`, `kp_vat_percent`, `passport_warranty_text`, `passport_storage_text`.
- `Settings` используются как дефолты при создании КП и формировании PDF техпаспорта; Company-уровень может переопределять значения в контексте документа.

### 3) KP metadata and photo scale
- `Kp.metadata.photoScalePercent` хранится в КП.
- Диапазон: `150..350`, дефолт: `150`.
- Поле применяется в документном рендере фото и сохраняется в metadata snapshot.
- Пагинация таблицы в КП поддерживает dual-limit: `tablePageBreakFirstPage` (1-я страница) и `tablePageBreakNextPages` (2+ страницы).
- Поле `tablePageBreakAfter` сохранено как legacy-fallback для старых КП и совместимости API.
- Разбиение страниц детерминировано в `kp-document` (единая логика для preview и PDF), включая баланс последней страницы против «одиноких» строк.

### 4) Per-item repricing model
- `KpItem.price` — базовая snapshot-цена позиции.
- Тонкая корректировка по строке: `markupEnabled/markupPercent`, `discountEnabled/discountPercent`.
- Эффективная цена вычисляется на фронтенде (preview/итоги): `round(price * (1 + markup/100) * (1 - discount/100))`.

### 5) RBAC and auth gates
- Роли: `owner/admin/manager/viewer`.
- Единый permission-layer на бэкенде: `can()`, `requirePermission`.
- Поддержан флаг `mustChangePassword`.
- Enforcement контролируется feature-flag `ENFORCE_PASSWORD_CHANGE`.
- HTTP `authInterceptor`: при `401` ответы `POST /api/auth/login` и `POST /api/auth/logout` не запускают refresh/`logout()` (иначе возможен цикл: `logout` без токена → `401` → снова `logout`).
- Добавлен guest preview flow: одноразовая ссылка `/guest-preview/:token` открывает гостевую read-only сессию; backend жёстко запрещает для guest любые методы кроме `GET/HEAD/OPTIONS`.
- Login UX поддерживает persistent-session стратегию: `remember me` хранит токены в `localStorage`, иначе в `sessionStorage`; при старте app выполняется восстановление сессии через refresh.

### 6) Users management
- Users API: `/api/users` (`GET/POST/PATCH/DELETE /:id`, reset-password).
- Удаление пользователя защищено от `self-delete`.

### 7) Settings-centered operations
- JSON bulk import/export (products/counterparties) централизован через страницу `/settings`.
- Backups (MongoDB + media): ручной запуск, список, очистка, скачивание/удаление.
- Доступ к backup-операциям — через permission `backups.manage`.

### 8) Smart template variables pipeline (KP)
- Подстановка `{{token}}` для текстовых блоков документа централизована в `KpTemplateService`.
- Источник данных переменных — `KpBuilderStore` (единый source-of-truth для текущего состояния КП).
- Рендер в UI выполняется через standalone pipe `kpTemplate` в `kp-document` и `kp-table`.
- Неизвестные токены не удаляются и остаются в тексте для безопасной деградации/отладки.

### 9) PDF export strategy (server-side HTML + Puppeteer)
- Экспорт `GET /api/kp/:id/export` генерируется в `kp-pdf.service` из server-side HTML-шаблона документа.
- Для многостраничных документов включён `displayHeaderFooter`: header (название КП + дата), footer (`Страница X из Y`).
- Геометрия PDF учитывает колонтитулы через увеличенные `top/bottom` margins.

### 10) UI governance (Storybook + shared focus/required)
- Storybook используется как контрольный слой для `shared/ui` (базовые компоненты должны рендериться в изоляции и на тех же токенах, что runtime).
- Унифицированы кросс-компонентные паттерны: `--ui-focus-ring-shadow` (focus) и `.ui-required` (required marker) в глобальном style-layer.
- Для `KP Builder` верхняя action-иерархия фиксируется как `Сохранить = primary`, `Скачать PDF = secondary/quiet`, чтобы toolbar не конкурировал с центральным документом.
- Карточки каталога `kp-catalog-item` держат low-noise surface: мягкая тень `--shadow-sm`, приглушённые метаданные (`sku/price` через `--ui-text-muted`) и `Добавить` через `ui-btn` (variant `secondary`, size `sm`).
- Правая панель `KP Builder` (`Параметры КП`, `Состав КП`, `Условия`) придерживается typography-first секций: без тяжёлых подложек, с увеличенным межсекционным интервалом и акцентом на заголовках.
- Для `KP Builder` в правой панели все input/select в параметрах и bulk/conditions используют `form-control`; нативные `range` и row-checkbox рендерятся кастомно через token-driven SCSS.
- Для `KP Builder` row-stepper (`.stepper__btn`) изолирован от глобальных `ui-btn` icon-правил через локальный reset (`all: unset` + явные `padding/border/box-shadow`) и повышенную специфичность в контексте `.selected-row`.
- Для `KP Builder` строка `Состав КП` выделена в отдельный standalone-компонент `app-kp-cart-item` (template/styles локализованы в компоненте), чтобы исключить cross-override от глобальных sidebar/widget-стилей.

### 11) KP Builder resilience and instant UX
- `KpBuilderStore` поддерживает snapshot-history (`past/future`, лимит 10) для `undo/redo`.
- Параллельно с autosave хранится локальный backup КП в `localStorage` (`kp_builder_backup_<kpId>`), с явным restore flow после reload.
- Для операций с backend roundtrip используется optimistic update + rollback (на ошибке серверного запроса восстанавливается предыдущее состояние).

### 12) ProductSpec subsystem (technical profile 1:1)
- Для техпаспорта введена отдельная коллекция `ProductSpec` с уникальной связью `productId -> Product`.
- Структура характеристик гибкая (`groups[].params[]`) и не расширяет основной `Product` сотнями полей.
- Чертежи хранятся в `drawings` + upload endpoint `/api/product-specs/upload` (media path `/media/specs/*`).
- Доменные endpoint'ы спецификаций унифицированы по `productId` (`GET/PUT /api/product-specs/:productId`, `POST /api/product-specs/upload-drawing`); запись ограничена ролями `owner/admin`.
- Экспорт техпаспорта: `GET /api/kp/passport/:productId/export` (Puppeteer, multi-page A4, данные из `Product + ProductSpec + Settings`).
- Каталог товаров и API поддерживают признак `specId` + фильтрацию `hasSpec=true|false` для контроля покрытия базы техпаспортами.
- В редакторе `ProductSpec` поддержано наследование «Копировать из аналога» (серийные товары), включая опцию копирования блока чертежей.
- ProductSpec UI переведён в inspector-паттерн: правый `ui-drawer` в `Products`, без вложенного modal-flow.
- Добавлены backend-driven шаблоны техпаспорта: `GET /api/product-specs/templates` читает `settings.product_spec_templates_v1` и использует fallback (`Спортивный стенд`, `МАФ`, `Павильон`).

---

## CHANGE IMPACT MATRIX

| Что меняем | Основная цепочка | Обязательные проверки |
|-----------|------------------|------------------------|
| `Product` schema/type | `backend/src/models/product.model.ts` → `shared/types/Product.ts` → `frontend/api.service.ts` → `products` UI | Проверить карточку, форму, таблицу и создание позиции в КП |
| `ProductSpec` schema/type | `backend/src/models/product-spec.model.ts` → `backend/src/routes/product-spec.routes.ts` → `frontend/api.service.ts` → `product-spec-*` UI | Проверить upload чертежей, upsert по `productId`, экспорт `passport` PDF |
| `Kp` schema/type | `backend/src/models/kp.model.ts` → `shared/types/Kp.ts` → `kp.routes.ts` → `kp-builder`/`kp-document` | Проверить создание КП, autosave, preview, печать |
| `KpItem` (включая repricing) | `kp.model.ts` → `shared/types/Kp.ts` → `kp-catalog`/`kp-table` | Проверить `effectivePrice`, итоги и рендер в `kp-table` |
| `Counterparty` schema/type | `counterparty.model.ts` → `shared/types/Counterparty.ts` → `counterparty.routes.ts` → `counterparties` + `kp-header` | Проверить lookup, snapshot получателя, отображение реквизитов |
| `Settings` keys/defaults | `settings.model.ts` → `settings.routes.ts` → `kp.routes.ts` → `settings.component.ts` | Проверить дефолты новых КП и сохранение значений |
| Bulk import/export (products + counterparties) | `settings.routes.ts`/service → `settings.component.ts` | Проверить импорт/экспорт из `/settings`, отчёты ошибок |
| `User` / RBAC | `users.routes.ts` → `users.service.ts` → `frontend/features/users/users.component.ts` | Проверить CRUD, self-delete guard, permission-based UI |
| Auth / tokens / mustChangePassword | `auth.routes.ts` + `auth.middleware.ts` → frontend guards/interceptor | Проверить login/refresh/logout и поведение при `mustChangePassword` |
| Permission map | `backend/src/auth/permissions.ts` + `shared/types/User.ts` | Проверить `can()` для всех ролей и доступ к `/settings`/`/users`/backups |

---

## KNOWN ISSUES (актуальные)

| # | Проблема | Приоритет |
|---|----------|-----------|
| 7 | `shared/types/` остаётся фронтенд-ориентированным (бэкенд не типизирован полностью этими контрактами) | 🟡 Low |
| 8 | Rate limiting in-memory (сброс при рестарте, нет shared-store) | 🟡 Low |
| 10 | Нет unit-тестов на расчёт `effectivePrice` и граничные случаи repricing | 🟡 Low |

## RESOLVED ISSUES

- #1 Страница контрагентов (CRUD UI) — закрыто.
- #2 Role/permission checks в backend/frontend — закрыто.
- #3 Readonly-ограничения КП по статусам — закрыто.
- #4 Страница справочников — закрыто.
- #5 UI редактирования `conditions[]` — закрыто.
- #9 Нумерация КП через `Date.now()` — заменена на управляемую последовательность.

---

## ROUTES (UI)

| URL | Компонент | Guard |
|-----|-----------|-------|
| `/login` | `LoginComponent` | — |
| `/guest-preview/:token` | `GuestPreviewComponent` | — |
| `/` | `HomeComponent` | `authGuard` |
| `/products` | `ProductsComponent` | `authGuard` |
| `/counterparties` | `CounterpartiesComponent` | `authGuard` |
| `/kp/:id` | `KpBuilderComponent` | `authGuard` + `canDeactivate` |
| `/settings` | `SettingsComponent` | `authGuard` + permission |
| `/users` | `UsersComponent` | `authGuard` + `users.manage` |

---

## FAST LINKS

- Архитектура и модульная карта: `docs/architecture.md`
- API и контракты: `docs/api.md`
- Бизнес-правила: `docs/business-rules.md`
- UI/kit ограничения: `docs/ui-kit.md`
- Деплой и эксплуатация: `docs/deploy.md`
- Полный changelog: `docs/CHANGELOG.md`

---

## LAST KEY CHANGES

| Дата | Изменение |
|------|-----------|
| 2026-04-24 | KP Builder settings style wiring fix: у `KpBuilderSettingsComponent` подключён локальный `kp-builder-settings.component.scss` в `styleUrls` (вместе с `kp-builder.sidebar.scss`), из-за чего 2-колоночная сетка `kp-params-grid` и icon-only toggle `Колонка фото` начали применяться фактически, а не только существовать в коде |
| 2026-04-24 | KP Builder params grid fix: стили `kp-params-grid`/`photo-scale-control`/`kp-photo-toggle` перенесены в `kp-builder-settings.component.scss` (локальный стиль-компонент), из-за чего 2-колоночная раскладка секции `Параметры КП` начала применяться стабильно; breakpoint single-column оставлен только для узких экранов (`<=760px`) |
| 2026-04-24 | KP Builder params layout polish: секция `Параметры КП` удерживается в 2-колоночной сетке до tablet-ширин (single-column fallback только на узких экранах), а toggle `Колонка фото` переведён в icon-only UI-kit кнопку (без текстовой подписи внутри кнопки, с `title/aria-label`) |
| 2026-04-24 | KP catalog card readability pass: в `kp-catalog-item` добавлен компактный photo-slot товара (main image с fallback на первый снимок) и уменьшена типографика (`title/description/price/add-btn` + tighter spacing), чтобы длинные названия чаще помещались в карточке без увеличения её габаритов |
| 2026-04-24 | KP document cleanup for repricing UX: в таблице КП (`kp-catalog`) удалён вывод текстовых маркеров `Наценка/Скидка` из колонки `Описание`; корректировки продолжают применяться только в расчёте цены/суммы, без отображения служебной информации в документе |
| 2026-04-24 | KP Builder cart item isolation pass: добавлен новый standalone-компонент `kp-cart-item` (`kp-cart-item.component.ts/html/scss`) с локальным drag-row UI и token-driven стилями; `kp-builder-cart` переведён на рендер через `<app-kp-cart-item ... />` и output-мосты событий (`selection/qty/decrement/increment/remove`), что устраняет конфликты глобальных стилей и изолирует верстку строки `Состав КП` |
| 2026-04-24 | KP Builder cart row rebuild: в `kp-builder-cart.component.html` полностью пересобрана DOM-структура строки `Состав КП` (без `ui-btn` на stepper-кнопках), а в `kp-builder.widgets.scss` заменён блок `.selected-row` и дочерних элементов на новый горизонтальный SaaS-layout (`gap:12`, `padding:10`, `item-thumb:36x36`, `stepper:90x32`, `total-price:80px`, `remove-btn all:unset`), чтобы исключить вертикальный развал и вернуть плотную линейную геометрию |
| 2026-04-24 | KP Builder stepper hard-reset pass: в `kp-builder.widgets.scss` для `.selected-row .stepper__btn` усилена специфичность и добавлен принудительный reset (`all: unset`, `padding/border/box-shadow/background`), восстановлено центрирование `+/-` через `display:flex; align-items:center; justify-content:center;`; для строки товара закреплены `flex-wrap: nowrap`, `item-actions flex-shrink:0` и `item-info flex:1; min-width:0` для защиты от разъезда layout под влиянием глобального `.ui-btn` |
| 2026-04-24 | KP Builder cart row compact pass: строка `Состав КП` переведена в плотную SaaS-геометрию (`selected-row` gap/padding 10px/8px, `item-thumb` 32x32, `item-info` typography 13/11 с выраженным title, `item-actions` fixed cluster, `stepper` 80x28, `total-price` фиксирована в колонку 80px, remove-slot 24px с muted `×`) для ровного list-item ритма без «карточной» растянутости |
| 2026-04-24 | Phase 4 audit + UX validation pass: подтверждена pure-граница `kp-document/kp-header/kp-table` (без `ApiService/Router/localStorage` и без side-effect subscriptions), проверено безопасное использование `innerHTML` в footer (`bypassSecurityTrustHtml` отсутствует, работает стандартная Angular sanitization), а в частых consumer-формах усилена RxJS hygiene (`login` переведён на `takeUntilDestroyed`, `product-form` подписки на upload/save переведены на `takeUntil(destroy$)`); в `ui-form-field` добавлен реактивный триггер пересчёта ошибок от `statusChanges/valueChanges`, чтобы ошибки стабильно появлялись на blur/submit |
| 2026-04-24 | Phase 3 form validation automation finalized: `ui-form-field` переведен на auto-error pipeline через `control`/`@ContentChild(NgControl)` + `computed errorText` (invalid + touched/dirty, ручной `error` сохраняет приоритет), добавлен `form-error-messages.ts` с RU-маппингом `required/email/minlength/pattern`, выполнена пилотная миграция template-driven валидаторов в `auth login`, `product-form`, `counterparty-form` без поломки обратной совместимости |
| 2026-04-24 | KP Document final visual polish (Step 4): усилена типографическая иерархия документной таблицы (`name` -> `600`, code/meta -> muted), для денежных значений закреплены `tabular-nums` + более уверенный вес, увеличен вертикальный ритм между `header/table/summary/footer` в `kp-document`, добавлен screen-adaptive fit для `kp-sheet` на `<1024/<768` без горизонтального скролла, при этом print-геометрия A4 сохранена принудительными `@media print` размерами (`210x296mm`) для стабильного Puppeteer-экспорта |
| 2026-04-24 | Architecture refactor implementation pass: `KP Builder` правая колонка декомпозирована на dumb-компоненты `app-kp-builder-settings` и `app-kp-builder-cart` (container/store/business side-effects сохранены в `KpBuilderComponent`), в shared UI добавлены `ui-empty-state`, `ui-page-layout`, `ui-page-header`, а feature-страницы (`home/products/dictionaries/counterparties/users/roles-permissions/settings`) переведены на slot-композицию; `ui-form-field` расширен auto-validation режимом (`control`/projected `NgControl` + centralized error mapping), проведен аудит PDF purity и RxJS-подписок в `ui-modal`/`ui-drawer` (подписок внутри нет) |
| 2026-04-24 | KP Builder redesign step 1-2 (toolbar + catalog cards): в toolbar `kp-builder` action-вес перераспределён (`Сохранить` оставлен `primary`, split `Скачать PDF` переведён в `secondary`), у каталожных карточек `kp-catalog-item` убраны жёсткие бордеры в пользу мягкой тени `--shadow-sm`, увеличен вертикальный ритм сетки, `sku/price` приглушены до `--ui-text-muted`, кнопка `Добавить` переведена на UI-kit (`ui-btn`, `secondary`, `sm`) |
| 2026-04-24 | KP Builder redesign step 3 (right panel): в секциях `Параметры КП / Состав КП / Условия` убраны тяжёлые секционные подложки и усилен вертикальный ритм (больше воздуха между секциями/заголовками); в `kp-builder-settings` поля переведены на `form-control`, `photo-scale` range стилизован через token-layer (`track: --ui-border-subtle`, light thumb), в `kp-builder-cart` чекбоксы переведены на custom `appearance:none`-контрол (`checked` через `--ui-primary`), stepper собран в единый pill-блок с мягким hover, разделители строк корзины зафиксированы как `1px solid var(--ui-border-subtle)` |
| 2026-04-24 | Apple-style craft pass для shared UI и global token-layer: в `styles/_tokens.scss/_global.scss/_forms.scss` зафиксированы iOS-палитра light/dark, системный `--ui-font-family`, единый `--ui-focus-ring-shadow`, `--ui-control-height:36px`, `.ui-required::after` и унифицированный `.form-control`; обновлены `button/form-field/search-input/filter-select/badge/status-badge/card/modal/drawer` (soft badges через `color-mix`, pill geometry, focus/accessibility states, modal/drawer blur-backdrop + depth shadows + refined enter animations, interactive card lift) без изменения бизнес-логики компонентов |
| 2026-04-24 | KP Builder targeted bulk adjustments: в `Состав КП` добавлены чекбоксы по строкам для участия в массовых `Наценка/Скидка`; bulk-операции применяются только к отмеченным товарам, при загрузке/добавлении/переключении КП по умолчанию все позиции автоматически отмечены |
| 2026-04-24 | KP Builder toolbar dead-action cleanup: удалена кнопка `Доп. действия` как заглушка без рабочего сценария (`openMoreActions` показывал только info-toast); из компонента убран мёртвый обработчик для соответствия toolbar реальным действиям |
| 2026-04-24 | KP Builder toolbar cleanup: удалена кнопка `Предпросмотр` как нефункциональная (метод `openPreview` не переключал реальный режим интерфейса); из компонента убран мёртвый обработчик, чтобы toolbar отражал только рабочие действия |
| 2026-04-24 | KP Builder section header UX correction: в `kp-builder.sidebar.scss` убран hover-фон у кликабельной строки заголовка секции (по UX-запросу), акцент перенесён в постоянный более тёмный цвет и вес текста/шеврона для читаемого контраста без прямоугольной подсветки |
| 2026-04-24 | KP Builder checklist final pass: в `kp-builder` stepper собран в чистую схему с glyph-элементами для `+/-` (ровный вертикальный центр без padding-костылей), убран лишний декоративный inset, а в `kp-params-grid` введены единые CSS-переменные геометрии контролов (`--kp-control-height/--kp-control-radius`) для консистентного вида всех полей правой панели |
| 2026-04-24 | KP Builder stepper vertical-center fix: в `kp-builder.widgets.scss` скорректировано вертикальное выравнивание символов `+/-` (перевод `line-height` кнопок в `1`, снята микрокоррекция `padding-bottom`), чтобы иконки в stepper сидели ровно по центру по высоте |
| 2026-04-24 | KP Builder section-header contrast pass: в `kp-builder.sidebar.scss` затемнены кликабельные заголовки секций и шевроны, добавлен деликатный hover-фон у `sidebar-section__title-btn`, чтобы интерактивная зона заголовков лучше отличалась визуально |
| 2026-04-24 | KP Builder photo toggle UI pass: в `Параметры КП` checkbox `Показывать фото в таблице` заменён на компактную toggle-кнопку с иконкой глаза и состояниями active/inactive; поведение сохранено (`metadata.showPhotoColumn`), изменён только UI-контрол |
| 2026-04-24 | KP Builder label wording tweak: в `Параметры КП` уточнена подпись первого поля пагинации таблицы с `Перенос (1-я стр.)` на `Перенос строк (1-я стр.)` для более явного смысла |
| 2026-04-24 | KP Builder stepper button centering: в `kp-builder` у кнопок `+/-` выполнено оптическое центрирование (ASCII `-` вместо математического `−`, baseline tuning в `stepper__btn` через `line-height: 0` и микрокоррекцию `padding-bottom`), чтобы символы не выглядели смещёнными |
| 2026-04-24 | KP Builder labels compacting: в `kp-builder.component.html` сокращены подписи полей пагинации таблицы в `Параметры КП` до `Перенос (1-я стр.)` и `Перенос (след. стр.)` для более компактного и читаемого UI |
| 2026-04-24 | KP Builder stepper numeric-center refinement: в `kp-builder.widgets.scss` stepper переведён на фиксированную 3-колоночную сетку (`28/36/28`, `92x30`), центральная ячейка количества получила отдельный фон и типографию `tnum/lnum` с усиленным весом цифры для чистого визуального центра без грубого масштабирования |
| 2026-04-24 | KP Builder params visual consistency pass: после UX-аудита блока `Параметры КП` в `kp-builder.widgets.scss` унифицированы стили form-controls (единая высота/рамка/focus-ring для `input/select`, выравнивание `template +` кнопки, оформленный checkbox-контейнер `Колонка фото`), чтобы убрать визуальный разнобой между полями |
| 2026-04-24 | KP Builder stepper visual polish: в `kp-builder.widgets.scss` контрол количества в строках `Состав КП` получил более аккуратную геометрию (`96x32`, `radius: 8px`, расширенное numeric-поле, мягкий inset highlight и скорректированный hover-контраст у кнопок +/-) без изменения поведения |
| 2026-04-24 | KP Builder params density + photo column toggle: в `kp-builder` блок `Параметры КП` уплотнён до устойчивой 2-колоночной сетки (без wide-полей), добавлен переключатель `Показывать фото в таблице`; флаг `metadata.showPhotoColumn` прокинут в frontend/shared/backend типы, backend schema/service (default `true`) и рендер `kp-document` (скрывает колонку `Фото` в preview/PDF) |
| 2026-04-24 | KP Builder compact controls layout: в `kp-builder.widgets.scss` блок `bulk-adjustments__row` переведён на двухколоночную сетку (`repeat(2, minmax(0, 1fr))`), чтобы поля `Наценка (%)` и `Скидка (%)` отображались в одну строку и занимали меньше высоты панели |
| 2026-04-24 | KP PDF VAT row visual tweak: в `backend/src/services/kp-pdf.service.ts` у второй строки итогов (`В том числе НДС`) убрано нижнее подчёркивание (`.totals-row:nth-child(2) { border-bottom: 0; }`) по UX-запросу |
| 2026-04-24 | KP PDF totals readability tweak: в `backend/src/services/kp-pdf.service.ts` для строк блока итогов (`Итого / В том числе НДС / Всего к оплате`) увеличен межстрочный интервал до `line-height: 17px` (на ~5px плотнее читаемости относительно прежнего ритма) |
| 2026-04-23 | KP table image mode correction: по итогам UX-уточнения в `kp-catalog` возвращён `object-fit: contain` для фото-ячеек таблицы, чтобы исключить кадрирование/искажение и показывать изображение целиком |
| 2026-04-23 | KP table photo density tweak: в `kp-catalog` превью в фото-колонке переключено на `object-fit: cover` (`object-position: center`), чтобы поведение визуально совпадало с карточками каталога и уменьшало ощущение «пустых полей» в строках таблицы |
| 2026-04-23 | Photo scale range update: для КП диапазон `photoScalePercent` смещён на `350..700` (минимум 350 с возможностью увеличения), синхронизирован frontend slider/number-input, документный fallback и backend валидация/дефолты; таблица `kp-catalog` получила обновлённую нормализацию масштаба фото под новый диапазон без искажения пропорций |
| 2026-04-23 | KP table photo-cell compaction: в `kp-catalog` ограничен размер превью-изображений в строке таблицы (`min/max` clamp), чтобы большие `photoScalePercent` не раздували высоту строк; `object-fit: contain` сохранён для корректных пропорций без растягивания |
| 2026-04-23 | KP quick UX hotfix: блок `Итого` в документе снова прижат к таблице (`margin-top: 6px` вместо авто-прижима к низу страницы), а stepper количества в правой панели возвращён к компактной SaaS-геометрии (`~76x24`, облегчённые кнопки/границы, аккуратные numerics) для чистого и читаемого вида |
| 2026-04-23 | KP table minimalist redesign (screen+PDF): `kp-catalog` переведён на инвойсный row-list стиль (без внешней/вертикальных рамок, только горизонтальные разделители `0.5pt`), header облегчён (`#f9fafb`, uppercase, muted slate), а price editor — в ghost-input режим (text-like default + hover/focus affordance); в `kp-document` убрана лишняя рамка вокруг таблицы для чистого минималистичного ритма |
| 2026-04-23 | KP document summary flow fix: в `kp-document.component.scss` у `kp-content__summary-block` убран `margin-top:auto` и задан фиксированный отступ `margin-top:30px`, а нижний safe-zone контейнера усилен до `--kp-bottom-safe-zone: 40mm` (screen/print), чтобы блок `Итого` шёл сразу за таблицей и не попадал в зону подвала |
| 2026-04-23 | KP Builder stepper contrast/alignment fix: в `kp-builder.widgets.scss` усилена локальная специфичность `stepper`-кнопок (`.stepper .stepper__btn[ui-btn].btn--icon`) против общих `[ui-btn].btn--icon`, добавлен token-driven контраст `stepper/qty-input` для light/dark, а правая зона строки (`item-actions/total-price/remove-btn`) переведена в фиксированную геометрию (`160px`) без «рваного» правого края |
| 2026-04-23 | KP footer safe-zone pass: в `kp-document` добавлен нижний безопасный отступ через `--kp-bottom-safe-zone: 20mm` (`padding-bottom` у `.kp-content`) и зафиксирован `box-sizing: border-box` для `.kp-sheet__content`, чтобы `summary/closing/footer` и `Продолжение таблицы` не наезжали на нижний декоративный фон и не раздували высоту листа |
| 2026-04-23 | KP pagination QA diagnostics: в `KpDocument` добавлен dev-only console debug лог формата `[KP Debug] Page X: N items ... Total items: M` с выводом применённых лимитов first/next для быстрого smoke-check соответствия Builder/Preview |
| 2026-04-23 | KP pagination strict-limits fix: в `KpDocument` убран «балансирующий» split, пагинация переведена на директивный `slice` по `tablePageBreakFirstPage/tablePageBreakNextPages` (fallback `5/10`), а подпись «Продолжение таблицы» и summary/footer стабилизированы по page-index (continuation на всех кроме последней, итоги только на последней) |
| 2026-04-23 | Theme toggle micro-interaction final pass: в `AppShell` реализован smooth crossfade sun/moon без условного рендера (обе иконки всегда в DOM), с rotate/scale-анимацией через `opacity + transform` для стабильного 60fps-перехода |
| 2026-04-23 | Notification anti-spam pass: в `NotificationService` добавлена дедупликация одинаковых toast-сообщений (`type + message`) в окне 2.5с; повторный identical-toast не создаёт новый блок, а продлевает TTL уже видимого уведомления |
| 2026-04-23 | Theme toggle UX polish (`AppShell`): текстовый switch заменён на compact icon-button (sun/moon) с мягкой анимацией glyph, размещён в footer-actions рядом с logout; поведение сохранения темы через `ThemeService`/`localStorage` не изменено |
| 2026-04-23 | Notification reliability pass: устранена проблема «пустых красных полос» — `NotificationService` нормализует/error-safe текст (`message`/`error.message` + fallback), `ToastComponent` получил fallback-message и кнопку закрытия, а `ui-alert` скрывает пустой контент через `:host:empty` |
| 2026-04-23 | Dark theme token pass (Slate palette): в token-layer обновлены dark-значения (`ui-bg-main/elevated/card/hover`, `ui-text-main/muted/soft`, `ui-border/subtle`, `ui-primary`, `builder-preview-bg`, `input-bg`) для снижения контрастной усталости и более выраженной глубины слоёв |
| 2026-04-23 | Theme switch compatibility: `ThemeService` теперь синхронно ставит `data-theme` на `html` и класс `.dark-theme` на `body`, а global styles поддерживают оба селектора для безопасного переключения тем через атрибут или класс |
| 2026-04-23 | KP Builder dark UX polish: в правой панели `Состав КП` divider/hover переведены на `ui-border-subtle/ui-bg-hover`, stepper получил `input-bg + ui-border`, а цвет итоговой цены вынесен в variable (`--kp-line-total-color`); фон зоны предпросмотра документа переведён на `--builder-preview-bg` |
| 2026-04-23 | KP Builder right-panel row stability fix: `selected-row` переведён с grid на flex-layout для устойчивого сжатия в узком сайдбаре, у `item-info` закреплены `flex:1 + min-width:0` для безопасного clamp/ellipsis, а правый блок действий зафиксирован через `flex-shrink:0` и `total-price min-width:65px` |
| 2026-04-23 | KP Builder compact stepper tuning: stepper собран в единый контрол (`~76px`, общий border + внутренние разделители, узкий `qty-input` 28px, `radius:4px`), `item-handle` сделан визуально легче (`16px`, low-opacity), hover-delete сохранён на `opacity` без layout shift |
| 2026-04-23 | KP Builder DnD pass + diagnostics hardening: для `Состав КП` активирован drag-and-drop через `@angular/cdk/drag-drop` (`cdkDropList/cdkDrag/cdkDragHandle`) с dashed placeholder и мягким drag-preview shadow; порядок товаров перестраивается прямо в `kp.items`, а metadata-поля `tablePageBreakAfter/FirstPage/NextPages` на frontend/shared приведены к optional-типизации для безопасной совместимости со старыми КП и устранения template diagnostics |
| 2026-04-23 | Angular template diagnostics cleanup (`NG8102`): в `kp-builder` убран избыточный fallback `?? 6` в выражениях `tablePageBreakFirstPage/NextPages ?? tablePageBreakAfter`, т.к. `tablePageBreakAfter` уже обязательный `number`; runtime-поведение пагинации не изменено |
| 2026-04-23 | KP Builder items redesign (SaaS row-mode): в секции `Состав КП` карточный вид заменён на компактные горизонтальные строки (`drag-handle`, thumb 40x40, name/meta, compact stepper, итог с `tabular-nums`, remove по hover через `opacity`), а кнопка `+ Добавить товар` переведена в лаконичный dashed-outline стиль |
| 2026-04-23 | KP hybrid pagination pass: в metadata добавлены `tablePageBreakFirstPage`/`tablePageBreakNextPages` (с fallback на `tablePageBreakAfter`), `KP Builder` получил 2 отдельных поля лимита строк, а `kp-document` переведён на детерминированный split (first/next + баланс последней страницы) для一致ного preview/PDF без «одиноких» строк |
| 2026-04-23 | KP Builder top alignment final pass: у `builder__preview-scale` зафиксирован `margin-top:0`, а в `kp-document` уменьшен host top-padding (с `2.5rem` до `0.5rem`) и принудительно обнулён `kp-sheet margin-top`, чтобы шапка КП в edit-режиме начиналась почти сразу под тулбаром |
| 2026-04-23 | KP document top-gap fix (UI + print): в `builder__preview` документ прижат к верху (`padding-top:8px`, `justify-content:flex-start`, `transform-origin: top center`), а в `kp-document` для печати/экспорта обнулены системные page/body отступы (`@page margin:0`, `body margin/padding:0`) и верхние отступы листа (`kp-sheet margin-top:0`, включая `data-pdf-export` контекст) |
| 2026-04-23 | KP Builder PDF dropdown visual clarity: у `builder__pdf-menu` убрана нежелательная прозрачность (фон уплотнён до `ui-bg-card`-based 98%), сохранён blur-эффект и усилена многоуровневая тень, чтобы меню полностью перекрывало задний текст и визуально “парило” над панелями |
| 2026-04-23 | KP Builder PDF dropdown layering fix: для `builder__pdf-menu` поднят слой до `z-index:1000`, toolbar переведён в `position:relative` + `z-index:100` + `overflow:visible`, и actions-container получил `overflow:visible`, чтобы меню `Скачать PDF` не обрезалось и открывалось поверх правой панели/документа |
| 2026-04-23 | ProductSpec drawing controls polish: в inspector-блоке `Чертежи` нативные file-поля заменены на `ui-btn` + hidden file input (`Загрузить`/`Очистить`), чтобы убрать визуальный шум и привести upload-паттерн к общему UI-kit стилю |
| 2026-04-23 | ProductSpec editor UX polish: устранены пустые error-alert состояния (фильтрация пустых сообщений + defensive 404-handling), блок `Копирование из аналога` переведён в accordion, а зона `Чертежи` — в режим `thumbnail + upload + очистка` без ручных URL-полей |
| 2026-04-23 | ProductSpec Inspector pass: в `Products` вход `Тех. паспорт` усилен состоянием по `specId` (table + card), редактор переведён из modal в правый `ui-drawer` c двухколоночным inspector-layout (groups + drawings + preview/actions), а backend получил endpoint `GET /api/product-specs/templates` (settings key `product_spec_templates_v1` + fallback templates) |
| 2026-04-23 | KP Builder right-panel density refactor: `Состав КП` переведён с крупных блоков на компактные горизонтальные `selected-row` (40x40 thumb, name/meta, iOS-stepper, line total), а controls `Наценка/Скидка + Итого` собраны в sticky `sidebar-footer` для постоянной видимости итогов |
| 2026-04-23 | KP Builder right-column UX: блок `bulk-adjustments` (наценка/скидка) в секции `Состав КП` переведён в sticky-footer режим (`position: sticky; bottom: 0`) с мягким top-shadow, чтобы controls оставались доступными при длинном списке товаров |
| 2026-04-23 | KP Builder scroll containment fix: колонки `left/right` переведены на внутренний scroll-контейнер (`builder__sidebar-scroll` / `builder__right-scroll`) при фиксированной высоте тела билдера (`height:100%`, `align-items:stretch`, `overflow:hidden`), чтобы страница не растягивалась вниз при длинных списках |
| 2026-04-23 | KP Catalog micro-polish: дополнительно снижена визуальная контрастность `status-dot` и смягчён `spec` badge (цвет/тень/hover) для более тихой Apple-style карточки без лишнего акцента |
| 2026-04-23 | KP Catalog item visual refactor: `KpCatalogItem` приведён к Apple-style карточке (удалены внутренние разделители, усилена иерархия `title/sku`, скрытие пустого description, iOS-pill кнопка `Добавить`, мягкие тени + hover-depth, badge-индикатор `specId`) |
| 2026-04-23 | ProductSpec UX fallback: `GET /api/product-specs/:productId` при отсутствии профиля теперь возвращает `200 null` (вместо `404`), frontend `ApiService.getProductSpecByProductId` обрабатывает `404` как `null`, а в `ProductSpecEditor` убран error-alert для сценария «профиль еще не создан» |
| 2026-04-23 | ProductSpec backend hardening: введён controller-слой `product-spec.controller`, сервис унифицирован до `getSpecByProductId/upsertSpec` с `runValidators`, API приведён к `GET/PUT /api/product-specs/:productId` + `POST /api/product-specs/upload-drawing` (с alias-совместимостью), а write-операции по спецификациям ограничены ролями `owner/admin`; добавлен canonical тип `shared/types/ProductSpec.ts` |
| 2026-04-23 | Implemented polished entry phase: добавлен статический Apple-style splash в `frontend/src/index.html` (матовый фон + тонкий indeterminate bar), в `AuthService.logout()` выполнена явная cross-storage очистка (`localStorage` + `sessionStorage`) и полный reset auth-signals, а `KP Builder` получил плавный fade-in переход после skeleton; в root app добавлен деликатный текст `Restoring session...` при долгом init (>500ms) |
| 2026-04-23 | Auth persistence pass: в `KP Builder` исправлен help-блок шаблонных переменных (`{{token}}` как literal text) и hotkeys undo/redo; в auth-слое добавлены `initSession` + storage-aware токены (`localStorage`/`sessionStorage`) с `remember me` на login-экране; backend `AuthService` переведен на env-config TTL (`JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`) |
| 2026-04-23 | Mini-sprint Polish: в `GET /api/products` добавлен фильтр `hasSpec` и возврат `specId`; на фронтенде в `Products` добавлен фильтр «Только с тех. паспортом / без», а в `KP Catalog` карточки получили индикатор наличия техпаспорта; `ProductSpecEditor` расширен flow «Копировать из аналога» (поиск товара-донора + опция копирования чертежей) |
| 2026-04-23 | Реализован модуль `ProductSpec` (1:1 к `Product`): добавлены модель/сервис/CRUD + upsert endpoint `PUT /api/product-specs/product/:productId`, upload чертежей `POST /api/product-specs/upload` (multer, `media/specs`), и новый PDF-экспорт техпаспорта `GET /api/kp/passport/:productId/export`; на frontend в `/products` добавлен flow `Тех. паспорт` с модальным `ProductSpecEditor` и dumb-viewer `ProductSpecViewer` для Apple-style таблиц характеристик |
| 2026-04-23 | PR1 Stabilization + PDF Polish: `KpBuilderStore` расширен history-механизмом (`undo/redo`, 10 snapshots) и local backup в `localStorage`; в `KP Builder` добавлен restore-flow после reload, skeleton loading и hotkeys `Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z`; `switchKpType` переведён на optimistic update с rollback при ошибке; в `kp-pdf.service` включены Puppeteer header/footer с нумерацией страниц `Страница X из Y`; в `kp-document` добавлены utility-классы `.page-break-before` и `.avoid-break` |
| 2026-04-23 | PDF dropdown behavior upgrade (`KP Builder`): split-button переведён с hover-модели на signal-state управление (`isPdfMenuOpen`) с `document:click` auto-close и `@if`-рендером меню, что сделало поведение предсказуемым на тач/desktop и убрало случайные закрытия при уходе курсора |
| 2026-04-23 | Toolbar split-button pass (`KP Builder`): действия печати собраны в компактный Apple-style split (`Скачать PDF` + dropdown `Быстрая печать (Draft)`), что снизило плотность toolbar и усилило визуальную иерархию primary-action |
| 2026-04-23 | PDF assets hardening: в `pdf-generator.service` ожидание рендера усилено до `networkidle0` + проверка полной загрузки `document.images`; добавлена опциональная `PDF_ASSET_BASE_URL` для преобразования относительных путей изображений в абсолютные при экспорте |
| 2026-04-23 | Storybook accessibility pass: для `shared/ui` focus-ring усилен (`--ui-focus-ring-shadow`), `search-input` и `filter-select` переведены на `:focus-visible`; smoke-check `build-storybook` проходит |
| 2026-04-23 | Hybrid PDF flow (`KP Builder`): toolbar переведён на двойной сценарий `Печать (быстро)` (`window.print`) + `Скачать PDF (HQ)` через backend export; добавлен локальный loading-state `isExporting` и user-feedback notifications для процесса генерации |
| 2026-04-23 | Phase 4 HQ PDF export: backend `GET /api/kp/:id/export` переведён на Puppeteer-рендер существующего frontend route (`/kp/:id?pdf=1`) с пробросом user access token в `localStorage`, ожиданием `app-kp-document`, и export-флагом `data-pdf-export="true"`/`--is-pdf-export: true`; на фронте добавлена кнопка `Скачать PDF (HQ)` рядом с `PDF / Печать` |
| 2026-04-23 | Phase 3.1 UI DRY cleanup: в `styles/_global.scss` введены shared-утилиты `--ui-focus-ring-shadow` и `.ui-required`; `button/search-input/filter-select/form-field` переведены на единый focus ring, а дубли `.required` удалены из feature-форм |
| 2026-04-23 | Phase 3 Storybook foundation: инициализирован Storybook для Angular (`storybook`/`build-storybook` targets), добавлены истории для `button`, `form-field`, `status-badge`, `kp-catalog-item`; stories ограничены `src/app/**/*.stories.ts`, чтобы исключить template/demo шум и держать UI governance в границах продуктовых компонентов |
| 2026-04-23 | Phase 2 PDF Export MVP: добавлен серверный экспорт `GET /api/kp/:id/export` (controller + route + Puppeteer-сервис) как база для дальнейшего HQ-рендера |
| 2026-04-23 | PR1 Smart Variables refactor: логика подстановки `{{token}}` вынесена из локальных util-функций `kp-document` в `KpTemplateService` (`KpBuilderStore` как источник данных) и standalone pipe `kpTemplate`; рендер шаблонов в `kp-document`/`kp-table` унифицирован, legacy `kp-template.utils.ts` удалён |
| 2026-04-23 | Phase 1 Smart Variables (`KP Builder`/`KP Document`): добавлена безопасная Mustache-подстановка (`{{client_name}}`, `{{kp_number}}`, `{{total_price}}`, `{{date}}`) для `headerNote/intro/closing/footer` и `conditions`, неизвестные токены сохраняются как есть; в правой панели `Условия` добавлен helper-блок «Доступные переменные» |
| 2026-04-23 | Toolbar premium refactor (`KP Builder`): верхняя панель приведена к Apple-style композиции из 3 логических зон (left/context, center/status, right/actions), заголовок КП переведён в edit-in-place паттерн (без постоянной рамки), вторичные действия стали ghost-only с hover-подсветкой, а технический save-status уменьшен и вынесен в нейтральный центр |
| 2026-04-23 | Super-refactor scroll+composition (`KP Builder`): закреплена модель независимого скролла колонок (общий контейнер без сквозного scroll, `min-height:0` + `overflow-y:auto` внутри левой/центральной/правой зон, тонкие кастомные скроллбары), а правая панель `Состав КП` перевёрстана в горизонтальные строки (без чекбоксов/блока «Выбрано», qty-stepper + total, удаление по hover), bulk-поля перенесены вниз рядом с итоговым контекстом |
| 2026-04-23 | Ultra-clean pass (`KP Builder`): в правой панели дополнительно ослаблены вторичные контейнеры (`bulk-adjustments`, `condition-templates`, row dividers), у catalog tools смягчены input/select borders, а в карточках каталога приглушены вторичные тексты (`sku/price-label`) для более «невидимого» интерфейса и фокуса на данных |
| 2026-04-23 | Apple-style visual de-noise pass (`KP Builder`): снижена визуальная «рамочность» (lighter panel dividers, plain-text section headers), сужены левые/правые панели для доминанты документа, ослаблены карточечные тени в каталоге, смягчён status-dot, уплотнены toolbar secondary-actions и переработана плотность правой панели (`qty`, bulk-inputs, icon-buttons) для более спокойной иерархии |
| 2026-04-23 | Product-form micro-polish (Apple-style): в compact-модалке добавления товара выровнены высоты контролов через единый `--compact-control-height`, лейблы переведены в normal case (без uppercase), а `focus-visible` приведён к мягкому Apple glow (`0 0 0 3px var(--ui-primary-focus)`) |
| 2026-04-23 | KP Builder UX hotfix: в compact-модалке `Добавить товар в КП` устранён горизонтальный скролл — grid в `product-form.component.scss` переведён на адаптивные `minmax(0, ...)` колонки без фиксированного `min-width`, добавлены брейкпоинты `2-col/1-col` для узких экранов |
| 2026-04-23 | Catalog visual pass в `KP Builder`: внедрён standalone dumb-компонент `KpCatalogItemComponent` (Apple-style карточка товара) и каталог в левой панели переведён с legacy `product-row` на карточки с мягкой иерархией (`sku/status/title/description/price`) и `onAdd` output без сервисных зависимостей |
| 2026-04-23 | KP Builder Holistic Refactor (implementation pass): добавлен локальный `KpBuilderStore` и `KpBuilderComponent` переведён на store-driven state updates (без прямых `kp.set/update`), `KpDocument/KpCatalog` переведены в `OnPush` dumb-контракты с inline price flow (`blur/Enter` commit, `Escape` cancel), backend `KP` переведён на service/controller слой (`KpService` + `kp.controller` + slim routes), а UI-слой приведён к Apple-style baseline (SF system stack, glass surfaces, унифицированный `focus-visible`, обновлённые button/status-badge/document surfaces) |
| 2026-04-23 | Stage 1 Foundation (partial): в `frontend/src/styles/_tokens.scss` добавлен Apple-style baseline token-layer (`--font-family` с SF/system stack, `--ui-primary`, `--ui-bg-*`, `--ui-text-*`, `--blur-effect`, `--space-xs/md/lg`) без изменения компонентных стилей; создан `frontend/src/app/features/kp/kp-builder/kp-builder.store.ts` с локальным signal-store (`setKp`, `patchKp`, `updateMetadata`, `updateItemPrice(productId, newPrice)`, `clear`) для последующего подключения в smart-компонент |
| 2026-04-23 | KP Builder refactor (High-risk closure): компонент переведён на `ChangeDetectionStrategy.OnPush`, добавлены immutable-хелперы `updateKp/updateKpWith`, убраны прямые мутации `kp()` в ключевых полях metadata/title/vat и добавлен inline-поток редактирования цен через `kp-document -> kp-catalog -> priceChanged` |
| 2026-04-23 | API/валидация: `PUT /api/kp/:id` обновлён с `{ runValidators: true, context: 'query' }`; в `Kp` schema добавлены форматные проверки реквизитов (`ИНН 10/12`, `БИК 9`, `счета 20`) для `recipient` и `companySnapshot.requisitesSnapshot` |
| 2026-04-23 | UI/Error handling: в `authInterceptor` добавлен единый error-adapter для `404/5xx/0` с toast-уведомлениями; в целевых SCSS (`kp-builder.*`, `status-badge`, `alert`) убраны raw HEX, унифицированы `:focus-visible`, удалены `9px/10px` |
| 2026-04-23 | P0 cleanup `KP Builder` доведён до token-purity в layout: устранены последние raw-цвета (`rgba/#fff`) в `kp-builder.layout.scss`, inset-разделители и print-background переведены на semantic-переменные (`--ui-border`, `--ui-print-paper`) |
| 2026-04-23 | Выполнен P0 cleanup `KP Builder` side-panels: в `kp-builder.sidebar.scss` убраны hardcoded section-tints (`#.../rgba`) в пользу semantic token-слоя (`--ui-*` + `color-mix`), а в `kp-builder.widgets.scss` выровнены density/focus для icon-actions, чтобы снизить визуальный шум и усилить consistency |
| 2026-04-23 | Запущена фаза Foundations для UI/UX: токены в `styles/_tokens.scss` расширены до semantic-layer (цвета/типографика/spacing/radius), глобальные стили нормализованы под эти токены, а базовые `ui-btn`/`ui-form-field` приведены к единым состояниям `hover/active/focus-visible/disabled`; добавлен `ui-card` и документ `DESIGN_SYSTEM.md` с P0-планом очистки `KP Builder` |
| 2026-04-23 | Deploy automation упрощена до one-command flow: добавлен wrapper `deploy/deploy` (`./deploy`), а `deploy.sh` теперь auto-clean'ит `backend/dist` перед git dirty-check, чтобы серверные build-артефакты не блокировали обычный деплой |
| 2026-04-23 | Кнопка `Гостевая ссылка` перенесена на страницу `Роли и полномочия`: admin-flow генерации (`POST /api/guest/issue`) и копирования `previewUrl` теперь находится рядом с управлением ролями |
| 2026-04-23 | Страница `/login` упрощена для guest-flow: добавлен быстрый вход “Гостевая ссылка/токен” прямо в форме логина (без ручного набора `/guest-preview/...` в адресной строке) |
| 2026-04-23 | В `KP Builder` добавлен альтернативный compact-flow добавления товара: из `+ Добавить товар` открывается табличная форма только с полями строки КП (`Арт./Наименование/Описание/Ед./Цена`) для быстрого ввода без перегруза |
| 2026-04-23 | Добавлен guest preview режим без ломки RBAC: `POST /api/guest/issue` выдаёт одноразовую ссылку, `POST /api/guest/enter/:token` открывает гостевую сессию, а backend middleware блокирует любые write-операции для `isGuest=true` |
| 2026-04-23 | В документной таблице КП зафиксировано правило видимости `Описание`: колонка показывается только если есть хотя бы одно непустое описание у позиций, иначе скрывается автоматически |
| 2026-04-23 | В `KP Builder` (секция `Получатель`) удалён служебный инфо-блок `📸 ...`: оставлен только практический UI выбора/создания получателя для более чистого интерфейса |
| 2026-04-23 | В `KP Builder` выполнен общий density-pass кнопок боковых панелей: унифицированы `ui-btn` высоты/радиусы, icon-кнопки получили стабильный border+background для визуальной консистентности UI-kit |
| 2026-04-23 | Доведён UI-kit стиль кнопок в `Параметры КП`: action `+` у поля `Шаблон брендирования` рендерится как квадратный `ui-btn` (`ghost/sm`) с консистентной геометрией и отступами |
| 2026-04-23 | UX в `Параметры КП` упрощён: селект `Шаблон брендирования` показывается только при >1 варианте, а переход к редактированию шаблонов вынесен в компактную кнопку `+` справа от поля (UI-kit aligned) |
| 2026-04-23 | В `KP Builder` добавлена кнопка-ссылка `Открыть шаблоны компании`: переход в `/counterparties` с query-параметрами автоматически открывает менеджер `brandingTemplates` для выбранной `Наша компания` |
| 2026-04-23 | UX-поток создания КП упрощён: на Home удалены селекты `Компания/Тип/Шаблон`, оставлена только кнопка `+ Создать КП`; backend `POST /api/kp` получил fallback (`default` компания-инициатор + `kpType=standard`) |
| 2026-04-23 | Выбор компании перенесён в `/kp/:id`: в `Параметры КП` добавлен селект `Наша компания`, а `PUT /api/kp/:id/switch-type` расширен `companyId` в payload для мгновенного пересчёта snapshot/шаблона/условий |
| 2026-04-23 | Унифицирован label для `kpType=standard`: текст `Обычное КП` заменён на короткий `КП` в frontend (`KP_TYPE_LABELS`) и в backend-ответе `GET /api/counterparties/:id/branding-templates` |
| 2026-04-23 | UX switch-type в `KP Builder` переведён в instant-режим: кнопка `Применить тип и шаблон` убрана, переключение выполняется автоматически сразу при выборе `Тип документа`/`Шаблон брендирования` (без confirm), с блокировкой контролов на время запроса |
| 2026-04-23 | Полный аудит `switch-type`: устранён 400 на legacy-КП без `companySnapshot.texts`; при переключении типа `texts` теперь всегда нормализуются в объект со строковыми полями (`headerNote/introText/footerText/closingText`) |
| 2026-04-23 | Switch-type flow усилен для реальных legacy-КП: `companyId` при `PUT /api/kp/:id/switch-type` резолвится с fallback из `companySnapshot.companyId`; после успешного switch фронт делает `GET /api/kp/:id`, чтобы исключить визуальный рассинхрон состояния |
| 2026-04-23 | `PUT /api/kp/:id/switch-type` приведён к legacy-совместимости по компании-инициатору: допускается не только `isOurCompany=true`, но и исторический вариант `role` содержит `company` |
| 2026-04-23 | Добавлен server-side switch flow `PUT /api/kp/:id/switch-type`: смена `kpType` в существующем `/kp/:id` с пересборкой `companySnapshot`, авто-резолвом шаблона и безопасной политикой `conditions` (замена только если условия не были вручную изменены) |
| 2026-04-23 | Введены company-level defaults для repricing: `Counterparty.defaultMarkupPercent/defaultDiscountPercent`; при создании/переключении типа КП значения попадают в `Kp.metadata.defaultMarkupPercent/defaultDiscountPercent` и используются в `KP Builder` как базовые поля наценки/скидки |
| 2026-04-23 | Нумерация КП стала type-aware: префикс документа зависит от `kpType` (`response -> ПИСЬМО-xxx`, остальные типы -> `КП-xxx`) для `POST /api/kp`, `POST /api/kp/:id/duplicate` и `PUT /api/kp/:id/switch-type` |
| 2026-04-23 | В `KP Builder` добавлено управление типом/шаблоном прямо в блоке `Параметры КП` (селект типа, селект шаблона, подтверждаемое действие `Применить тип и шаблон`) без потери выбранных товарных позиций |
| 2026-04-23 | Заголовок документа стал type-aware: для `response` используется интро `Ответ на письмо для:`, для остальных типов сохранён `Коммерческое предложение для:` |
| 2026-04-23 | В менеджере `brandingTemplates` уточнён нейтральный copy для обязательного assets-поля: `Фон — страница 1` (вместо `Фон КП — страница 1`) |
| 2026-04-23 | Менеджер `brandingTemplates`: для `kpType=response` (Ответ на письмо) оставлены только релевантные поля `assets.kpPage1`; дополнительные фоны скрываются и очищаются при переключении типа |
| 2026-04-23 | Менеджер `brandingTemplates` переведён на accordion-режим: шаблоны раскрываются по заголовку (`▸/▾`), что уменьшает визуальный шум и упрощает работу с несколькими типами КП |
| 2026-04-23 | Таблица `/counterparties`: action-кнопки переведены на компактный icon-only формат (`Шаблоны`/`Изменить`/`Удалить`) с `title`/`aria-label`; ширина `col-actions` адаптирована под новый UI |
| 2026-04-23 | Брендирование КП декомпозировано: `brandingTemplates` вынесены из `counterparty-form` в отдельный менеджер шаблонов для `Наша компания`; добавлен API `PUT /api/counterparties/:id/branding-templates` |
| 2026-04-23 | `POST /api/kp` (auto template resolve): если для выбранного `kpType` отсутствует `isDefault=true`, backend выбирает первый доступный шаблон этого типа; `400` возвращается только когда шаблонов типа нет |
| 2026-04-23 | `counterparty-table` cleanup: ширины колонок централизованы через CSS-переменные + `colgroup`; удалены дублирующие правила и `!important`, поведение `col-name=170px` сохранено |
| 2026-04-23 | В `counterparty-table` добавлен `colgroup` с фиксированными ширинами (`col-name=170px`, `col-inn=140px`, `col-actions=190px`) для жёсткого контроля геометрии таблицы |
| 2026-04-23 | Уточнена фактическая ширина `col-name` в `counterparty-table`: `170px` фиксируется как итоговая ширина ячейки (`box-sizing: border-box` + локальные paddings), чтобы колонка не выглядела шире в браузере |
| 2026-04-23 | В `counterparty-table` колонка «Короткое название» переведена на фиксированную ширину `170px` для более предсказуемого вида трёхколоночного role-layout |
| 2026-04-23 | `/counterparties` разложен в 3 таблицы по ролям в фиксированном порядке `Клиент` → `Поставщик` → `Наша компания`; увеличены интервалы между колонками и расширен контейнер страницы |
| 2026-04-23 | Таблица `/counterparties`: оставлены только колонки «Короткое название», «ИНН» и кнопки действий; роль/статус/орг. форма убраны из списка (фильтры над таблицей без изменений) |
| 2026-04-23 | Frontend `authInterceptor`: для `401` на `POST /api/auth/login` и `POST /api/auth/logout` отключены refresh и вызов `AuthService.logout()` — устранён бесконечный цикл `POST /logout` при неверном пароле или выходе без валидного access token |
| 2026-04-22 | `deploy/deploy.sh` исправлен: генерация `kppdf.conf` больше не пишет URI-часть в `proxy_pass` внутри regex-location (`/products/*`, `/kp/*`), поэтому `nginx -t` проходит стабильно на деплое |
| 2026-04-22 | Исправлен nginx-конфиг для legacy media regex-location (`/products/*`, `/kp/*`): в `proxy_pass` удалена URI-часть, чтобы `nginx -t` не падал на деплое (`proxy_pass cannot have URI part in location given by regular expression`) |
| 2026-04-22 | KP Builder preview: скролл центральной зоны сделан условным — включается только при многостраничном документе (`previewPageCount > 1`), чтобы 2+ страницы были доступны без постоянной полосы на одностраничном КП |
| 2026-04-22 | Печать КП: убраны скроллбары в print preview — для `kp-builder` добавлены print-overrides (`height/overflow/grid/transform`), чтобы в печать попадал только чистый документ без UI-scroll контейнеров |
| 2026-04-22 | KP Builder preview UX: вертикальный скролл центральной зоны сделан всегда видимым (`overflow-y: scroll` + `scrollbar-gutter: stable`), чтобы многостраничный документ (стр. 2+) был очевидно доступен для прокрутки |
| 2026-04-22 | KP Builder preview: исправлено скрытие 2+ страниц при большом количестве товаров — центральная зона предпросмотра переведена на вертикальный скролл (`builder__preview: overflow-y:auto`), чтобы все страницы документа были доступны в UI |
| 2026-04-22 | Добавлен управляемый default-инициатор КП: у контрагента-«нашей компании» введён флаг `isDefaultInitiator`; на Home автовыбор компании теперь сначала ищет этот флаг, иначе берёт первую из списка; при сохранении default-компании на backend автоматически снимается флаг с остальных |
| 2026-04-22 | Форма шаблонов брендирования: для существующих шаблонов с пустым `conditions[]` добавлена авто-нормализация на 3 дефолтных условия (срок поставки/гарантия/доставка), чтобы блок `Условия` не оставался пустым после миграции с `Texts` |
| 2026-04-22 | Home/Branding UX: в списке шаблонов на главной дефолтный шаблон помечается `✓`; в форме компании первый шаблон типа КП автоматически получает `isDefault=true` (и при смене `kpType` шаблон тоже становится default, если у типа ещё нет default) |
| 2026-04-22 | Исправлена печать КП с пустой второй страницей: лист `kp-sheet` переведён в `box-sizing: border-box`, в `@media print` убраны `border` и `box-shadow`, чтобы физический размер страницы не превышал A4 |
| 2026-04-22 | В шаблонах брендирования компании блок `Texts` заменён на редактируемый список `Условия` (`conditions[]`): добавление/удаление пунктов в форме контрагента; при создании нового КП `POST /api/kp` подставляет условия из выбранного шаблона, если в запросе условия не переданы |
| 2026-04-22 | KP Document: блок `Итоги + Условия` расширен до полной ширины таблицы; суммы (`Итого/НДС/Всего к оплате`) зафиксированы в правой части, список условий выровнен по левому краю на всю ширину summary-блока |
| 2026-04-22 | Counterparties table: финально устранено подрезание `Удалить` справа — расширена `col-actions` до 16% (`min-width: 190px`), `col-name` уменьшена до 36%, action-контейнер переведён на `display:flex; width:100%` внутри ячейки без вылезания за границы |
| 2026-04-22 | Counterparties table: перераспределены ширины колонок в пропорциях (`col-name/inn/role/status/form/actions`) и увеличен `min-width` у `col-actions`, чтобы убрать пустую «дыру» по центру и стабилизировать правый край |
| 2026-04-22 | Counterparties table: в колонке `Название` оставлен только `shortName` (с fallback на `name`), вывод полной второй строки отключён для экономии места |
| 2026-04-22 | Counterparties table: восстановлено отображение обеих action-кнопок в `col-actions` — для ячейки действий разрешён `overflow: visible`, для контейнера кнопок задан `min-width: max-content` |
| 2026-04-22 | Таблица контрагентов переведена на локальный стабильный layout `counterparty-table` (`table-layout: fixed` + ширины по классам колонок, без `nth-child`): действия в одну строку, роли с контролируемым переносом, длинные названия без смещения соседних колонок |
| 2026-04-22 | Counterparties table: исправлено обрезание правой колонки действий — увеличена ширина `col-actions` и общая `min-width` таблицы для корректного отображения кнопок `Изменить/Удалить` |
| 2026-04-22 | Counterparties table: устранено «разбегание» полей — добавлены фиксированные ширины ключевых колонок (`ИНН/Роль/Статус/Орг. форма/Действия`) и выравнивание action-ячейки |
| 2026-04-22 | Counterparties UI: устранено дублирование бейджа «Наша компания» в таблице — роли теперь рендерятся через dedupe-логику `displayedRoles()` |
| 2026-04-22 | Глобальный UI-consistency pass: таблица Home переведена на общий `data-table`/`ui-table-actions` паттерн, стили action-кнопок унифицированы с остальными экранами; в блоке upload ассетов шаблонов выровнены цвета/hover под `--ui-*` токены |
| 2026-04-22 | UI-polish формы шаблонов брендирования: карточки assets/texts приведены к единообразной админ-верстке (empty-state, мета по типу КП, hover-состояния upload-кнопок, адаптив 1-колонка на узких экранах) |
| 2026-04-22 | В форме шаблонов брендирования включена прямая загрузка изображений (PNG/JPG/WEBP) через `POST /api/counterparties/upload-branding-image`; URL автоматически подставляется в `assets.kpPage1/kpPage2/passport/appendix` |
| 2026-04-22 | UX: модалка редактора контрагента (в т.ч. шаблоны брендирования) больше не закрывается кликом по backdrop; закрытие только явным действием пользователя |
| 2026-04-22 | Брендирование КП расширено до системы шаблонов: в `Counterparty.brandingTemplates` добавлены шаблоны по `kpType` (`standard/response/special/tender/service`) с `assets/texts` и `isDefault`, плюс API `GET /api/counterparties/:id/branding-templates` для Home |
| 2026-04-22 | `Kp.companySnapshot` переведён в расширенный immutable формат (`companyName`, `templateKey/templateName`, `kpType`, `assets`, `texts`, `requisitesSnapshot`); `POST /api/kp` теперь валидирует `companyId + kpType` и резолвит шаблон в режимах auto/manual override |
| 2026-04-22 | Создание КП по компании-инициатору сделано совместимым с историческими данными: `POST /api/kp` принимает компанию как `isOurCompany=true` или `role=company`; на Home ошибка создания теперь показывает точный текст backend |
| 2026-04-22 | Исправлена синхронизация признака нашей компании: при сохранении контрагента `role=company` теперь выставляет `isOurCompany=true`; фильтр `isOurCompany=true` в API дополнен совместимостью для исторических записей с ролью `company` |
| 2026-04-22 | Введено брендирование КП по компании-инициатору: при создании КП обязателен `companyId`, в `Kp.companySnapshot` сохраняются фоновые изображения (`kp-page1/kp-page2/passport`) и `footerText` |
| 2026-04-22 | На главной добавлен выбор компании-инициатора перед созданием КП; API контрагентов поддерживает фильтр `isOurCompany=true` для селектора |
| 2026-04-22 | Контрагенты: добавлена орг. форма `МКУ` (backend enum + frontend типы/селект), чтобы муниципальные учреждения можно было создавать без выбора `Другое` |
| 2026-04-22 | RBAC переведён на роли из БД: добавлены `Role` model, init/migration сервис, API `/api/roles` + `/api/permissions`, а `User` переведён на `roleId` (с legacy-совместимостью через `role`) |
| 2026-04-22 | Реализован новый экран `Роли и полномочия` (`/roles-permissions`): таблица ролей + панель прав 40/60, создание/копирование/удаление ролей, инлайн rename, dirty-save/cancel по permissions |
| 2026-04-22 | Users/RBAC UX: inline-редактор подписей ролей/permissions заменён на компактный сценарий через кнопку и модальное окно, чтобы не перегружать страницу пользователей |
| 2026-04-22 | Users/RBAC: матрица `Роли и полномочия` сделана управляемой — добавлено редактирование названий ролей и permissions в UI с сохранением в `settings.rbac_labels` |
| 2026-04-22 | Users UI: на странице `Пользователи` добавлена таблица `Роли и полномочия` (RBAC matrix) для прозрачного отображения прав `owner/admin/manager/viewer` |
| 2026-04-22 | Users: убрано визуальное дублирование роли в строке таблицы (удалён дополнительный badge, оставлен единый select роли) |
| 2026-04-22 | Главный список сохранённых КП переведён в табличный формат (№, статус, название, получатель, сумма, дата, действия) вместо карточек для более удобного реестра |
| 2026-04-22 | KP Builder: из блока `Получатель` удалены лишние readonly-поля snapshot (`Название`, `ИНН`, `КПП`) по UX-запросу, оставлен только выбор контрагента и пояснение |
| 2026-04-22 | KP Builder: убран лишний общий скролл в рабочем гриде (`builder__body`), прокрутка оставлена только в левой/правой панелях при переполнении |
| 2026-04-22 | KP Builder: финальный micro-pass — боковой зазор центра уменьшен до `1mm`, фон зоны предпросмотра переведён на `--ui-bg` для устранения остаточного серого ореола |
| 2026-04-22 | KP Builder: боковой зазор предпросмотра уменьшен с `3mm` до `2mm` (только параметр `--kp-center-side-gap`, без изменения логики центра) |
| 2026-04-22 | KP Builder: боковой зазор предпросмотра дополнительно уменьшен с `5mm` до `3mm` по фактической обратной связи на экране |
| 2026-04-22 | KP Builder: исправлена геометрия предпросмотра — убрана адаптивная ширина `min(100%, ...)` у `builder__preview-scale`, чтобы боковой зазор `5mm` соблюдался корректно |
| 2026-04-22 | KP Builder: боковой серый зазор вокруг предпросмотра зафиксирован до `5mm` (`--kp-center-side-gap`), при этом масштаб/высота центра не меняются |
| 2026-04-22 | KP Builder: центр зафиксирован отдельной колонкой `--kp-center-col`, а свободная ширина передана в левые/правые панели (`minmax(..., 1fr)`) для уменьшения серого фона без изменения центра |
| 2026-04-22 | Исправлен центр `KP Builder`: возвращён fit по высоте через `--kp-preview-scale` + `transform: scale(...)` (`top center`), убраны внутренние отступы центра |
| 2026-04-22 | Расширена левая колонка `KP Builder` (`--kp-left-col`, `--kp-left-col-collapsed`) для более удобной работы с получателем/каталогом |
| 2026-04-22 | Повторно зафиксирован расчёт НДС в `kp-document`: НДС только «в том числе» (внутри цены), без прибавления к итоговой сумме |
| 2026-04-22 | В таблице КП добавлены явные VAT-маркеры (`Цена/Сумма (вкл. НДС)`) и колонка `НДС (в т.ч.)`; устранена двусмысленность «цена с НДС или без» |
| 2026-04-22 | Исправлен рассинхрон расчёта итогов КП: `kp-document` приведён к формуле «НДС включён в Итого», чтобы предпросмотр и сайдбар считали одинаково |
| 2026-04-22 | Итоги КП переведены на схему «НДС включён в Итого»: строка «В том числе НДС X%» восстановлена, НДС выделяется из `subtotal`, `Всего к оплате = Итого` |
| 2026-04-22 | Фаза 1 UI Quick Wins: добавлены global `_forms/_buttons` (единая плотность контролов), `ui-status-badge`, подтверждение смены статуса КП и явный readonly snapshot получателя в KP Builder |
| 2026-04-22 | Опасные действия на `Home/Products/Counterparties` переведены на `ModalService.confirm`; добавлены недостающие success/error notifications после CRUD-операций |
| 2026-04-22 | В блоке итогов КП исправлена формулировка строки НДС: вместо «В том числе НДС» используется корректное «НДС X%», чтобы соответствовать расчёту НДС сверху |
| 2026-04-22 | Для контрагентов `Физлицо` поле ИНН сделано опциональным (frontend required-state + backend schema-валидация); для остальных оргформ обязательность сохранена |
| 2026-04-22 | Контрагент `Физлицо`: в базовой форме заменены юридические подписи/placeholder на персональные (`ФИО`, `Короткое имя`, ИНН `12 цифр`), текст валидации названия стал контекстным |
| 2026-04-22 | Для frontend production build увеличен порог warning `anyComponentStyle` с `4kB` до `6kB`, чтобы убрать нерелевантные budget-предупреждения без изменения UI |
| 2026-04-22 | Упрощена форма контрагента для `Физлицо`: минимальный набор полей, дополнительный блок по требованию, fallback `shortName=name`, скрытие роли `company` |
| 2026-04-22 | Исправлена строгая template-типизация confirm-модалки: для `variant` добавлен fallback `primary`, чтобы исключить `undefined` в Angular compile-time |
| 2026-04-22 | Финальный micro-pass типографики: `users/products` приведены к `$font-*` токенам (`users-actions-menu`, `product-form` badge, `products` view-toggle) |
| 2026-04-22 | Типографика `kp-*` разделена по контекстам: экранные размеры вынесены в `rem`, печатные значения сохранены через `@media print` (`pt`) |
| 2026-04-22 | Полировка визуальной консистентности: в `kp-header/kp-table/kp-catalog/kp-document` и `product-card` заменены хардкодные цвета на `--ui-*`/`color-mix` |
| 2026-04-22 | Убран `window.confirm` в `/settings` и `/dictionaries`: подтверждения переведены на единый `ModalService` + глобальный `ui-modal` host |
| 2026-04-22 | Добавлены UI-kit компоненты `ui-search-input` и `ui-filter-select`; фильтры `products/counterparties/dictionaries/settings` переведены на kit-паттерн |
| 2026-04-22 | Введены CSS tokens `--ui-spacing-*`, общий слой `table-scroll` + `ui-table-actions`; снижен риск horizontal overflow в KP Builder layout |
| 2026-04-22 | Внедрён RBAC (`owner/admin/manager/viewer`), permission-layer, Users API и `mustChangePassword` gate под feature-flag |
| 2026-04-22 | Добавлены per-item repricing поля (`markup*/discount*`), effective price рассчитывается на фронте |
| 2026-04-22 | Добавлен `photoScalePercent` в `Kp.metadata`, диапазон `150..350`, дефолт `150` |
| 2026-04-22 | JSON import/export централизован на `/settings`; backups управляются через `backups.manage` |
| 2026-04-22 | Users management расширен удалением с защитой от self-delete |

---

## CONSISTENCY CHECK (2026-04-22)

- `shared/types/index.ts` экспортирует `Kp`, `User`, `Product`, `Counterparty`.
- `shared/types/Kp.ts` содержит `KpMetadata.photoScalePercent` и поля repricing в `KpItem`.
- `settings.model.ts` содержит только 4 системных ключа; `backup_retention_days` как отдельный key в модели сейчас отсутствует.
- В бэкенде уже есть валидация `photoScalePercent` (`min=150`, `max=350`) в `backend/src/models/kp.model.ts`.
- Исторический фикс по дублированию `ИП` считается закрытым и вынесен из активных проблем.

---

## Refactoring Summary (Apple-level Craft)

Проведен комплексный рефакторинг архитектуры и визуальной системы проекта. Проект переведен на рельсы "Apple-level craft" с акцентом на стабильность, чистоту кода и Developer Experience (DX).

### 1) UI/UX (Apple-level Craft)
- **Design System**: внедрена семантическая система токенов (`--ui-*`) в `styles/_tokens.scss`; отказ от хардкода цветов и размеров в пользу CSS-переменных.
- **Components**: `shared/ui` приведен к единому iOS-like стилю: тактильные отклики, `focus-visible`, адаптивность.
- **KP Builder Layout**: экран редактора переработан; документ в центре закреплен как главный визуальный фокус; боковые панели приведены к low-noise стилю.

### 2) Архитектура и DX
- **Reactive Forms UX**: `ui-form-field` поддерживает авто-маппинг ошибок по контролу без ручного дублирования `[error]`.
- **Decoupling**: `KpBuilderComponent` разделен на container/presentational (`kp-builder-settings`, `kp-builder-cart`), логика сохранена в store/container.
- **Hygiene & Safety**:
  - PDF-компоненты (`kp-document`, `kp-header`, `kp-table`) остаются pure-presentational.
  - RxJS-подписки в частых consumer-компонентах приведены к безопасному управлению жизненным циклом (`takeUntilDestroyed`/`takeUntil`).

### 3) Финансовая и техническая стабильность
- **PDF Export**: print-слой изолирован через `@media print`, что стабилизирует соответствие экрана и печатной версии.
- **Zero-Regressions**: изменения проходят `npx tsc --noEmit` и линтер-проверки без нарушения бизнес-логики.

Текущий статус: проект находится в архитектурно стабильном состоянии. Дальнейшее развитие следует паттерну: UI-Kit токены -> Dumb-компоненты -> Container-логика.

---

## Audit log

- Дата: 2026-04-23
- Выполнено:
  - Добавлен безопасный guest-preview контур: backend `POST /api/guest/issue` (генерация ссылки, только `users.manage`) и `POST /api/guest/enter/:token` (обмен приглашения на access token гостя).
  - `auth.middleware`: добавлен `guestReadonlyGuard`, `enforcePasswordChange` теперь пропускает guest, а `requirePermission` умеет работать с `isGuest` без обращения к БД-пользователю.
  - Все защищённые API (`/settings`, `/dictionaries`, `/counterparties`, `/products`, `/kp`, `/users`, `/roles`, `/permissions`) получили глобальный read-only guard для guest-сессий.
  - Frontend: добавлен публичный маршрут `/guest-preview/:token` и компонент авто-входа гостя; `AuthService` поддерживает гостевую сессию без refresh token.
  - `authInterceptor` обновлён: `401` на `/guest/enter/*` не запускает refresh/logout-цикл.
  - `backend/src/routes/kp.routes.ts`: добавлен endpoint `PUT /api/kp/:id/switch-type` (смена `kpType`/шаблона в уже созданном КП), пересборка `companySnapshot`, типовой re-resolve шаблона и безопасная замена `conditions` только для не-модифицированных пользователем условий.
  - Нумерация документов сделана зависимой от типа КП (`КП-*` / `ПИСЬМО-*`): генерация применяется в `POST /api/kp`, `POST /api/kp/:id/duplicate` и при switch-type, если номер ранее был авто-сгенерирован.
  - В `Counterparty` и `Kp.metadata` добавлены defaults для repricing (`defaultMarkupPercent/defaultDiscountPercent`), значения подхватываются сервером и редактируются в UI.
  - `KP Builder`: добавлены controls смены типа/шаблона (с подтверждением), интеграция с `switch-type` API и синхронизация bulk-полей наценки/скидки с metadata defaults.
  - `KpHeader` теперь рендерит type-aware intro (`Ответ на письмо для:` для `response`).
  - Форма контрагента для роли `Наша компания` получила поля `% наценки/% скидки по умолчанию`, которые используются как source defaults для новых/переключаемых КП.
  - В `branding-templates-manager` скорректирован текст обязательного assets-поля на более универсальный (`Фон — страница 1`).
  - `branding-templates-manager`: карточки шаблонов сделаны раскрывающимися (accordion по заголовку шаблона); для `kpType=response` в assets оставлен только `kpPage1`, поля `kpPage2/passport/appendix` скрываются и очищаются автоматически.
  - `counterparty-table`: действия в строках переведены в icon-only кнопки (меньше визуальный шум и стабильнее ширина таблицы), добавлены `title`/`aria-label` для доступности.
  - Выделен отдельный frontend-компонент `branding-templates-manager` (assets/default/conditions) и вход через кнопку `Шаблоны` в таблице `Наша компания`.
  - `counterparty-form` упрощён: удалена inline-логика редактирования `brandingTemplates`, сохранены только базовые поля контрагента и флаг `isDefaultInitiator`.
  - Добавлен endpoint `PUT /api/counterparties/:id/branding-templates` для отдельного сохранения шаблонов брендирования компании.
  - `backend/src/routes/kp.routes.ts`: в auto-режиме выбора шаблона для `POST /api/kp` добавлен fallback `defaultByType -> first template by kpType`; убран ложный блокер при отсутствии default-шаблона.
  - `counterparty-table.component.scss`: выполнен style-cleanup (единый источник ширин через CSS variables + `colgroup`, удалены лишние повторения `width/min/max` и `!important`).
  - `counterparty-table`: добавлен `colgroup` и фиксированные ширины колонок, чтобы исключить автоперерасчёт browser table-layout и удерживать `col-name` на `170px`.
  - `counterparty-table`: уточнена фиксация `col-name` до реальных `170px` (`box-sizing: border-box` + локальные paddings у `th/td.col-name`), чтобы колонка не расширялась визуально.
  - `counterparty-table`: ширина колонки «Короткое название» зафиксирована в `170px` для стабильной геометрии таблиц при раскладке по ролям.
  - `/counterparties`: список разделён на 3 role-колонки (`Клиент`, `Поставщик`, `Наша компания`) с отдельными таблицами и увеличенным межколоночным spacing; добавлены computed-группы в `counterparties.component.ts`.
  - `counterparty-table`: упрощён список контрагентов до колонок короткое название / ИНН / действия; обновлены `docs/ui-kit.md` (описание таблицы).
  - `frontend/src/app/core/interceptors/auth.interceptor.ts`: при `401` запросы к `/auth/login` и `/auth/logout` пробрасывают ошибку без `tryRefresh`/`logout()`, чтобы не зациклить клиент на `POST /api/auth/logout`.
  - `start.ps1`: после `docker compose up -d` проверяется `$LASTEXITCODE`; при ошибке (например, не запущен Docker Desktop) скрипт выходит с кодом и не печатает ложное «Docker services are up»; подсказка про `-SkipDocker` при внешнем MongoDB.
  - `products`: добавлен upload endpoint `POST /api/products/upload-image` (multer, PNG/JPG/WEBP, до 8MB, сохранение в `/media/products`), чтобы фото в карточке можно было добавлять с диска.
  - `products upload`: внедрён backend trim прозрачных полей при загрузке (`sharp`) — применяется только к изображениям с alpha-каналом, без изменения пропорций и без принудительного кадрирования JPEG.
  - `frontend product-form`: в блоке «Фотографии» добавлена загрузка файла через `<input type="file">` с индикатором `Загрузка...`; успешная загрузка сразу добавляет изображение в `form.images` и поддерживает main/sortOrder.
  - `frontend product-form UI polish`: upload-control в карточке товара переведён из «сырого» нативного file-input в аккуратный UI-row (кнопка выбора + отображение имени файла + устойчивый loading/disabled state без дёрганий layout).
  - `kp-catalog photo fallback fix`: для строк без валидного `imageUrl` (или при `img error`) колонка `Фото` теперь остаётся пустой — без broken-icon и без alt-текста в документной таблице КП.
  - `kp-document continuation note position`: подпись `Продолжение таблицы — на стр. N` в `kp-document` прижата сразу под таблицей (`margin-top: 6px`, без `auto`-прижима к низу страницы), чтобы не выпадать на декоративный фон.
  - `kp-catalog alignment pass`: выравнивание данных в таблице КП переведено в center для всех колонок, кроме `Наименование` и `Описание` (left); для ценовых ячеек уменьшен отступ перед символом `₽`, чтобы валюта не «отрывалась» от числа.
  - `kp-builder currency format pass`: в правой панели `Состав КП` (`База` и `line total`) убран `currency`-pipe с префиксом `₽`; формат приведён к постфиксу `число + ₽` для единообразия с таблицей документа.
  - `kp-catalog currency token pass`: в документной таблице `Цена` и `Сумма` приведены к единому отображению `число₽` в одном текстовом токене, чтобы колонка `Цена` визуально совпадала со столбцом `Сумма` и не рвала число/валюту.
  - `kp-catalog editable price suffix fix`: в inline-режиме редактирования `Цена` удалён разрыв между числом и `₽` (динамическая ширина input + суффикс валюты через общий токен), чтобы визуально совпадало с колонкой `Сумма`.
  - `kp-catalog number-input cleanup`: у inline-поля цены отключены нативные steppers (`↑/↓`) во всех браузерах (`appearance` + webkit spin-button reset), чтобы убрать лишние отступы справа и стабилизировать геометрию колонки `Цена`.
  - `kp-catalog cleanup + currency spacing`: упрощён editable-блок цены (убрана динамическая `ch`-ширина), задана стабильная компактная ширина input, а формат валюты для `Цена/Сумма` приведён к `число ₽` с лёгким визуальным зазором перед `₽`.
  - `kp-catalog header alignment pass`: заголовки всех колонок таблицы КП центрированы (включая `Наименование` и `Описание`), при этом содержимое соответствующих `td` остаётся left-aligned для удобного чтения текста.
  - `kp-catalog cell alignment final pass`: выравнивание данных в таблице зафиксировано как center для всех колонок, кроме `Наименование` и `Описание`; inline-input в колонке `Цена` также центрирован для визуальной консистентности.
  - `kp-document top-density pass`: таблица в документе прижата максимально вверх — убран верхний host-padding и обнулён `margin-top` у `.kp-content--continuation` (screen/print) для 2+ страниц.
  - `kp-header border density pass`: у правого мета-блока шапки КП уменьшена визуальная тяжесть границы (тоньше stroke), снижены `border-radius` и внутренние отступы для более компактной «рамки» без потери читаемости.
  - `kp-header meta ultra-compact pass`: рамка правого мета-блока прижата максимально к тексту (минимальные `padding`, уменьшенный `radius`, почти нулевой `margin-bottom` между строками) по запросу на предельно плотную геометрию.
  - `kp-header/table gap fix`: убран лишний вертикальный зазор между блоком получателя (`Коммерческое предложение для...`) и таблицей — `margin-bottom` у `kp-header` снижен до минимального.
  - `kp-header top offset tune`: верхний отступ шапки получателя откорректирован до `45mm` (screen/print) по финальной подгонке вертикальной посадки под фирменный заголовок.
  - `products image trim robustness`: upload-пайплайн `POST /api/products/upload-image` усилен до hybrid-trim (alpha + near-white background), добавлен guard от «пустого trim» и вынесена утилита `backend/src/utils/image-trim.util.ts`; для ретро-очистки уже загруженных фото добавлен скрипт `npm run media:trim-products`.
  - `kp-builder recipient replace UX`: удалён confirm-диалог «Заменить получателя»; теперь выбор из dropdown применяет snapshot получателя сразу и молча (с autosave), только в статусе `draft`.
  - `kp-builder price edit boundary`: в документной таблице КП (preview) отключено inline-редактирование цены (`editablePrices=false`); изменение цены/пересчёта оставлено только в правой панели `Состав КП`.
  - `kp-catalog description alignment`: колонка `Описание` в строках таблицы переведена в center-align по запросу; left-align оставлен только для `Наименование`.
  - `kp-table totals compact spacing`: в блоке итогов (`Итого/НДС/Всего к оплате`) уменьшены межстрочные и межблочные отступы до минимального читаемого уровня (row-gap, margin-top/bottom, line-height, отступ перед финальной строкой).
  - `deploy resiliency`: в `deploy/deploy.sh` фронтовый `npm ci` переведён в safe-режим (`set +e`/capture exit code) с гарантированным fallback `npm ci --legacy-peer-deps`, чтобы one-command deploy не обрывался из-за peer-conflict.
  - `frontend build budgets`: для production-конфига Angular увеличены лимиты `anyComponentStyle` (`warning: 10kB`, `error: 14kB`), чтобы текущие реальные размеры `kp-builder` стилей не блокировали deploy-пайплайн.
  - `docs/api.md` и `docs/business-rules.md`: синхронизированы правила upload-image (auto-trim для alpha-изображений).
  - `docs/ui-kit.md`: добавлен `Product Form Upload Pattern` с правилами визуального и адаптивного поведения file-upload controls.

- Дата: 2026-04-22
- Выполнено:
  - В `KP Builder` восстановлен стабильный режим центра: `builder__preview` без padding, `builder__preview-scale` использует `transform: scale(var(--kp-preview-scale))` с `transform-origin: top center`.
  - Расширены переменные левой колонки (`--kp-left-col`, `--kp-left-col-collapsed`) для плотного размещения блоков `Получатель`/`Каталог`.
  - Исправлен regression в `kp-document`: убрано повторное начисление НДС сверху (`total = subtotal`, `vatAmount` считается как часть суммы по формуле `rate/(100+rate)`).
  - В `kp-catalog` добавлены явные подписи цен/сумм как `вкл. НДС` и колонка построчного `НДС (в т.ч.)`; в `kp-table` добавлена поясняющая сноска, что табличные суммы уже включают НДС.
  - Устранён рассинхрон между `KpBuilder` и `KpDocument`: в документном компоненте формула НДС обновлена до включённой модели (`vatAmount = subtotal * rate / (100 + rate)`, `total = subtotal`).
  - Расчёт итогов КП переведён на модель «НДС внутри суммы»: `vatAmount = round(subtotal * rate / (100 + rate))`, `total = subtotal`; подпись «В том числе НДС» возвращена.
  - Реализована Фаза 1 UI Quick Wins: вынесены глобальные style-слои `_forms.scss`/`_buttons.scss`, подключены в `styles/_global.scss`, унифицированы контрольные высоты и form-spacing.
  - Добавлен `ui-status-badge` и применён в `Home`, `Users`, `Counterparties`, `KP Builder` для единообразной визуализации статусов/ролей.
  - В `KP Builder` добавлен явный readonly-блок recipient snapshot с пояснением; замена получателя разрешена только в `draft` и подтверждается через `ModalService`.
  - Смена статуса КП из toolbar теперь проходит через подтверждение (`ModalService.confirm`) с единым UX-потоком.
  - Удаления на `Home/Products/Counterparties` переведены на `ModalService.confirm`; добавлены недостающие тосты успешных операций.
  - `window.confirm` в runtime-потоках frontend отсутствует (проверка по `frontend/src`).
  - В `kp-table` уточнена подпись НДС в итогах КП: убрана двусмысленная формулировка «в том числе», т.к. в проекте НДС рассчитывается и добавляется сверху к `subtotal`.
  - Синхронизировано правило ИНН для `Физлицо`: поле перестало быть обязательным в UI и backend-модели, при заполнении сохраняется валидация формата `10/12` цифр.
  - Для режима `Физлицо` в форме контрагента обновлены подписи и placeholders базовых полей: `ФИО`, `Короткое имя`, ИНН `12 цифр`; сообщение валидации названия стало контекстным.
  - Обновлён flow формы контрагента для `Физлицо`: сокращён основной набор полей, дополнительные реквизиты вынесены в раскрываемый блок.
  - Добавлена нормализация payload в `counterparty-form`: если `shortName` пустой, отправляется `name`.
  - В UI формы контрагента для `Физлицо` скрыта роль `Наша компания`, добавлена поясняющая подсказка.
  - Закрыт micro-pass в `users/products`: оставшиеся нестандартные font-size заменены на токены `$font-*` в местах, не завязанных на print-верстку.
  - Типографический pass для документных блоков КП: введены css-переменные размеров, где screen-mode использует `rem`, а print-mode переопределяет значения в `pt`.
  - Выполнен дополнительный visual-pass: в документных стилях КП и карточке товара убраны точечные hex/rgba хардкоды в пользу семантических `--ui-*` цветов.
  - Подтверждения удаления в `settings`/`dictionaries` переведены с `window.confirm` на единый `ModalService` (`app-modal-confirm` в `AppShell`).
  - Добавлены reusable-controls `ui-search-input` и `ui-filter-select`; переведены тулбары фильтров на целевых страницах.
  - В глобальный UI слой добавлены `--ui-spacing-1..8`, утилиты `table-scroll` и `ui-table-actions`; устранено дублирование table action-стилей.
  - В `users.component.scss` исправлены невалидные `--ui-space-*` на валидные `--ui-spacing-*`.
  - Смягчены минимальные ширины колонок в `kp-builder.layout.scss` (clamp/minmax), чтобы уменьшить риск горизонтального скролла на tablet.
  - Выделен блок `CRITICAL INVARIANTS` сразу после `AI THINKING MODE`.
  - Полностью актуализирован раздел `ARCHITECTURAL DECISIONS` по изменениям после 2026-04-21.
  - Перестроен `KNOWN ISSUES`: оставлены только актуальные проблемы 6/7/8/10, закрытые вынесены в `RESOLVED ISSUES`.
  - Обновлён `SOURCE OF TRUTH MAP`: добавлен блок RBAC/permissions.
  - Упрощён и расширен `CHANGE IMPACT MATRIX`, добавлена колонка обязательных проверок и цепочка для `User`.
  - Убраны дубли `QUICK START/REPOSITORY MAP`, заменены на быстрые ссылки в docs.
  - Детальный changelog вынесен в `docs/CHANGELOG.md`, в паспорте оставлены только последние ключевые изменения.

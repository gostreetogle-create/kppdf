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
- Актуальные системные ключи: `kp_validity_days`, `kp_prepayment_percent`, `kp_production_days`, `kp_vat_percent`.
- `Settings` используются как дефолты при создании КП; Company-уровень может переопределять значения в контексте документа.

### 3) KP metadata and photo scale
- `Kp.metadata.photoScalePercent` хранится в КП.
- Диапазон: `150..350`, дефолт: `150`.
- Поле применяется в документном рендере фото и сохраняется в metadata snapshot.

### 4) Per-item repricing model
- `KpItem.price` — базовая snapshot-цена позиции.
- Тонкая корректировка по строке: `markupEnabled/markupPercent`, `discountEnabled/discountPercent`.
- Эффективная цена вычисляется на фронтенде (preview/итоги): `round(price * (1 + markup/100) * (1 - discount/100))`.

### 5) RBAC and auth gates
- Роли: `owner/admin/manager/viewer`.
- Единый permission-layer на бэкенде: `can()`, `requirePermission`.
- Поддержан флаг `mustChangePassword`.
- Enforcement контролируется feature-flag `ENFORCE_PASSWORD_CHANGE`.

### 6) Users management
- Users API: `/api/users` (`GET/POST/PATCH/DELETE /:id`, reset-password).
- Удаление пользователя защищено от `self-delete`.

### 7) Settings-centered operations
- JSON bulk import/export (products/counterparties) централизован через страницу `/settings`.
- Backups (MongoDB + media): ручной запуск, список, очистка, скачивание/удаление.
- Доступ к backup-операциям — через permission `backups.manage`.

---

## CHANGE IMPACT MATRIX

| Что меняем | Основная цепочка | Обязательные проверки |
|-----------|------------------|------------------------|
| `Product` schema/type | `backend/src/models/product.model.ts` → `shared/types/Product.ts` → `frontend/api.service.ts` → `products` UI | Проверить карточку, форму, таблицу и создание позиции в КП |
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
| 6 | Нет upload изображений (только URL/media path) | 🟠 Medium |
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

## Audit log

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

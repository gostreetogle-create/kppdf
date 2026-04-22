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

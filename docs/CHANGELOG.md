# CHANGELOG

Подробная история изменений проекта `kppdf`.  
Краткая версия (последние ключевые изменения) поддерживается в `PROJECT_PASSPORT.md`.

---

## 2026-04-22

- KP Builder: `ui-modal` вместо `window.confirm` в `canDeactivate`.
- Autosave: отключён на первом рендере, включается после первой товарной позиции.
- Локализованы ошибки валидации Counterparty API (без префикса `validation failed`).
- Deploy без Docker: обновлены `deploy/deploy.sh`, `deploy/.env.example`, `docs/deploy.md`.
- Усилена безопасность deploy: safe update media/static, guard для dirty git tree.
- Nginx routing fixes для `/api`, `/media`, legacy `/products/*` и `/kp/*`.
- Settings: раздел backups (ручной запуск, список, удаление/скачивание, очистка).
- Удалены конфликтные dev proxy префиксы `/kp` и `/products`.
- Frontend routing fix: добавлен `<base href="/">`.
- KP Header: убраны лишние поля, исправлено дублирование `ИП`.
- KP Builder visual/layout passes: единый scroll/grid, адаптивные брейкпоинты, уплотнение таблиц.
- Repricing UX: per-item `markup/discount`, затем массовое и realtime-применение к выбранным строкам.
- Добавлен `photoScalePercent` в `metadata` (диапазон обновлён до `150..350`, дефолт `150`).
- Стабилизированы дефолты `tablePageBreakAfter = 6`.
- Type-sync hotfix: добавлены недостающие поля в shared/frontend типы.
- RBAC rollout: роли `owner/admin/manager/viewer`, permission layer, guards, users page.
- Auth gate stabilization: `ENFORCE_PASSWORD_CHANGE` как feature-flag.
- Users API/UX upgrades: create validation, diagnostics, delete с self-delete защитой, reset-password flow cleanup.
- Ops helper: `users:promote-admin`.

## 2026-04-21

- Добавлены Settings модель/API и страница `/settings`.
- Counterparty расширен (`isOurCompany`, `images[]` с context, `footerText`).
- `Kp` получил `companyId`; дефолты при создании читаются из Settings.
- `ProductImage.context` сделан optional, ввод через `createImage()`.
- APP_INITIALIZER и `authReady` gate при bootstrap.
- Sprint 1: полноценный CRUD контрагентов + форма + lookup DaData.
- Добавлен bulk import товаров и затем bulk import контрагентов.
- JSON-функции (import/export templates/reports) централизованы в `/settings`.
- KP Builder: readonly-ограничения по статусам, UI для `conditions[]`, UX полировка.
- Добавлена страница `/dictionaries`.
- Ролевая логика admin/manager и соответствующие UI guards.
- Нумерация КП стабилизирована и переведена на последовательность.
- Добавлен параметр `metadata.tablePageBreakAfter`.
- Медиа вынесены в `media/`, настроены static/proxy алиасы.

## 2026-04-20

- Инициализация стека: Angular + Express + MongoDB.
- Базовые CRUD для КП и товаров.
- Базовый UI kit, design tokens, auth flow (JWT + guard + interceptor).
- Counterparty модель и API lookup.


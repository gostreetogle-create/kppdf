# CHANGELOG

Подробная история изменений проекта `kppdf`.  
Краткая версия (последние ключевые изменения) поддерживается в `PROJECT_PASSPORT.md`.

---

## 2026-04-23

- Roles & Permissions UX: кнопка `Гостевая ссылка` перенесена в шапку страницы `Роли и полномочия`; ссылка генерируется через `POST /api/guest/issue` и сразу копируется в буфер.
- Login UX: добавлен максимально простой guest-вход на экране логина — можно вставить полную гостевую ссылку или JWT-токен и перейти в режим просмотра одной кнопкой.
- Guest preview: добавлен безопасный read-only режим по ссылке — `POST /api/guest/issue` (генерация ссылки для `users.manage`) и `POST /api/guest/enter/:token` (вход гостя), плюс backend guard, который запрещает гостю любые write-операции.
- Frontend auth: добавлен публичный маршрут `/guest-preview/:token` с авто-входом гостя; `AuthService` расширен поддержкой сессии без `refreshToken`.
- KP Builder products: добавлен compact-вариант добавления товара из КП (табличная модалка с полями `Арт./Наименование/Описание/Ед./Цена`), чтобы вводить позиции в формате, близком к таблице документа.
- KP document: колонка `Описание` теперь рендерится адаптивно — если у всех позиций пустое описание, столбец автоматически скрывается.
- KP Builder cleanup: из блока `Получатель` удалён служебный note (`📸 ...`), оставлен только практический control выбора/создания получателя.
- KP Builder UI polish: выполнен общий density-pass кнопок в боковых панелях (`Состав/Условия/Параметры`) — унифицированы высота/радиусы `ui-btn`, icon-кнопки получили border+background в едином UI-kit стиле.
- KP Builder UI-kit pass: `+` у поля `Шаблон брендирования` переведён на полноценный `ui-btn` (`ghost/sm`) со стабильной квадратной геометрией, чтобы кнопка визуально совпадала с остальными контролами панели.
- KP Builder UX polish: у поля `Шаблон брендирования` текстовая кнопка заменена на компактный `+` справа; селект шаблона скрывается, если для текущего типа есть только один вариант (auto без дублирования выбора).
- KP Builder UX: добавлена кнопка `Открыть шаблоны компании` в блоке `Параметры КП`; переход открывает `/counterparties` и автоматически поднимает менеджер шаблонов для текущей компании.
- Home/KP flow refactor: на главной убраны селекты `Компания/Тип/Шаблон`; `+ Создать КП` теперь создаёт черновик сразу, а выбор компании-инициатора, типа и шаблона перенесён в `KP Builder`.
- API `POST /api/kp`: `companyId` и `kpType` стали необязательными (fallback: default-инициатор + `standard`), чтобы поддержать новый упрощённый старт с Home.
- API `PUT /api/kp/:id/switch-type`: добавлена поддержка смены компании через `companyId` в payload (вместе с пересборкой snapshot/templates/conditions).
- UI copy: для типа `standard` подпись заменена с `Обычное КП` на `КП` (в селекторах фронтенда и в backend DTO списка типов шаблонов).
- KP Builder UX: убрана кнопка `Применить тип и шаблон`; переключение типа/шаблона выполняется автоматически при выборе значения (без confirm), контролы временно блокируются на время запроса.
- KP switch-type hotfix: устранён `400` для legacy-КП без `companySnapshot.texts` (ошибка cast `companySnapshot.texts: undefined`) — backend теперь нормализует `texts` в безопасную пустую структуру.
- KP switch-type audit-fix: добавлен fallback `companySnapshot.companyId` для legacy-документов без корневого `companyId`; после switch frontend перечитывает `GET /api/kp/:id`, чтобы исключить локальный визуальный рассинхрон.
- KP switch-type: добавлен `PUT /api/kp/:id/switch-type` для переключения типа КП в редакторе без потери товарных позиций; сервер пересобирает `companySnapshot`, резолвит шаблон и применяет safe-policy по `conditions`.
- KP numbering: нумерация стала type-aware (`response -> ПИСЬМО-xxx`, остальные типы -> `КП-xxx`) для create/duplicate/switch-type сценариев.
- KP Builder: в блок `Параметры КП` добавлены controls выбора типа/шаблона и подтверждаемое действие переключения.
- KP Header: intro-текст в документе зависит от `kpType` (`Ответ на письмо для:` для response, иначе классический текст КП).
- Company defaults: в карточке `Наша компания` добавлены `defaultMarkupPercent/defaultDiscountPercent`; эти значения прокидываются в `Kp.metadata` и используются как базовые значения bulk-полей в `KP Builder`.
- Counterparties/Branding copy: в менеджере шаблонов подпись обязательного поля изменена с `Фон КП — страница 1` на нейтральное `Фон — страница 1`.
- Counterparties/Branding logic: для шаблонов типа `Ответ на письмо` в редакторе оставлены только релевантные поля (`assets.kpPage1`); дополнительные фоны (`kpPage2/passport/appendix`) скрываются и очищаются автоматически.
- Counterparties/Branding UX: менеджер шаблонов переведён на accordion-карточки (раскрытие по названию шаблона `▸/▾`), чтобы убрать длинное полотно полей и ускорить работу с несколькими шаблонами.
- Counterparties: в таблице действий кнопки переведены в компактный icon-only формат (`Шаблоны`, `Изменить`, `Удалить`), action-колонка сужена под новый layout.
- Counterparties/Branding: `brandingTemplates` вынесены из `counterparty-form` в отдельный менеджер шаблонов (модалка из таблицы `Наша компания`), добавлено действие `Шаблоны` в строке компании.
- API: добавлен `PUT /api/counterparties/:id/branding-templates` для отдельного сохранения шаблонов брендирования компании.
- KP create: убран лишний блокер при `Auto`-выборе шаблона — если для `kpType` не задан `isDefault`, `POST /api/kp` теперь берёт первый доступный шаблон этого типа (ошибка только когда шаблонов типа нет совсем).
- Counterparties: стили `counterparty-table` очищены — ширины колонок сведены к единому источнику (CSS variables + `colgroup`), удалены дубли и `!important`.
- Counterparties: для таблицы добавлен `colgroup` с фиксированными ширинами колонок, чтобы `Короткое название` гарантированно оставалось `170px` без перераспределения браузером.
- Counterparties: уточнена фиксация `170px` для колонки «Короткое название» — применён `box-sizing: border-box` и локальные paddings ячейки, чтобы визуальная ширина оставалась ровно `170px`.
- Counterparties: в `counterparty-table` колонка «Короткое название» зафиксирована в `170px`.
- Counterparties: список разбит на 3 отдельные таблицы по ролям в фиксированном порядке слева направо — `Клиент`, `Поставщик`, `Наша компания`; увеличены интервалы/layout-контейнер секции.
- Counterparties: таблица списка — только «Короткое название», «ИНН», «Изменить/Удалить»; колонки роль/статус/орг. форма скрыты (toolbar-фильтры сохранены).
- Auth: в `authInterceptor` для `401` на `POST /api/auth/login` и `POST /api/auth/logout` отключены refresh и принудительный `logout()` — устранён бесконечный спам `POST /logout` (раньше `logout` без Bearer → `401` → снова `logout`).
- Локальный старт: `start.ps1` учитывает код выхода `docker compose` и не сообщает об успехе, если демон Docker недоступен (иначе MongoDB на `:27017` не поднимается).

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


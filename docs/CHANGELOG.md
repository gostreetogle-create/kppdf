# CHANGELOG

Подробная история изменений проекта `kppdf`.  
Краткая версия (последние ключевые изменения) поддерживается в `PROJECT_PASSPORT.md`.

---

## 2026-05-05

- **Типизация и синхронизация (Issue #7)**: В бэкенде внедрен слой DTO (`backend/src/dtos/`), который гарантирует строгое соответствие данных из MongoDB каноническим интерфейсам в `shared/types/`. Контроллеры КП, товаров и контрагентов переведены на использование мапперов DTO.
- **Стабилизация расчетов (Issue #10)**: Логика расчета эффективной цены (`calculateEffectivePrice`) и итогов КП полностью перенесена в общую библиотеку `shared/utils/price.utils.ts` и покрыта 21 модульным тестом (Vitest), включая проверку наценок до 500%, скидок до 100% и корректность округления.
- **Надежность PDF**: В `kp-pdf.service.ts` добавлен retry-механизм для Puppeteer (3 попытки) и оптимизирована загрузка изображений через `PDF_ASSET_BASE_URL`. Реализовано ожидание полной загрузки `img` перед рендерингом.
- **UI/UX Аудит**: Глобально внедрена система семантических отступов `--ui-spacing-*`. Для всех основных списков (КП, товары, контрагенты) добавлены состояния "Empty States" (`ui-empty-state`) для улучшения UX при отсутствии данных.
- **Архитектурная безопасность**: В `KpBuilderStore` введено жесткое ограничение истории изменений (10 снимков) для предотвращения утечек памяти. `authInterceptor` усилен защитой от циклических редиректов при ошибках 401.

---

## 2026-04-23

- Split-button interaction pass: PDF dropdown в `KP Builder` переведён с hover-показа на signal-управление (`isPdfMenuOpen`) + `document:click` close-handler и `@if`-рендер меню.
- Toolbar split-button polish: в `KP Builder` действия `Скачать PDF` и `Быстрая печать` собраны в компактный Apple-style split-control (primary + dropdown), чтобы снизить перегруз верхней панели.
- PDF export reliability: в `pdf-generator.service` рендер переведён на `waitUntil: 'networkidle0'`, добавлено ожидание полной загрузки `document.images`, а также опциональная переменная `PDF_ASSET_BASE_URL` для абсолютных путей к логотипам/товарным изображениям при PDF-генерации.
- Storybook accessibility pass: усилен `--ui-focus-ring-shadow`, `ui-search-input` и `ui-filter-select` используют `:focus-visible`; smoke-проверка `npm run build-storybook` успешна.
- Hybrid print/export integration: в `KP Builder` разделён сценарий `Печать (быстро)` (`window.print`) и `Скачать PDF (HQ)` (backend), добавлен `isExporting` loading-state и уведомления о старте/успехе/ошибке генерации.
- HQ PDF export (phase 4): `GET /api/kp/:id/export` переведён на Puppeteer-рендер существующего frontend route `/kp/:id?pdf=1`; backend прокидывает `kp_access_token` в browser context, ждёт `app-kp-document`, выставляет `data-pdf-export="true"` + `--is-pdf-export: true`, а фронт получил кнопку `Скачать PDF (HQ)` рядом с `PDF / Печать`.
- UI DRY cleanup (phase 3.1): добавлены глобальные utility `--ui-focus-ring-shadow` и `.ui-required`; `shared/ui` (`button`, `search-input`, `filter-select`, `form-field`) унифицированы по focus/required-паттернам, локальные `.required`-дубли удалены из feature-форм.
- Storybook coverage update: добавлена история для `search-input`; сборка `npm run build-storybook` стабилизирована через stories-scope `src/app/**/*.stories.ts`.
- Storybook foundation (phase 3): подключён Storybook для Angular (`storybook`/`build-storybook`), добавлены истории для `button`, `form-field`, `status-badge`, `kp-catalog-item`; stories scope ограничен `src/app/**/*.stories.ts` для фокуса на продовых компонентах.
- PDF Export MVP (phase 2): добавлен `GET /api/kp/:id/export` с backend-генерацией через Puppeteer (`A4`, `10mm`, `printBackground: true`) и базовым page-break guard для товарных строк.
- PR1 Smart Variables refactor: подстановка `{{token}}` вынесена из `kp-document` util-функций в `KpTemplateService` (`features/kp/kp-builder/kp-template.service.ts`) с source-of-truth от `KpBuilderStore`; добавлен standalone pipe `kpTemplate` и подключён в `kp-document`/`kp-table`; legacy `kp-template.utils.ts` удалён.
- Smart Variables (phase 1): в `kp-document` добавлен token-map и безопасный Mustache-resolver для текстов (`headerNote/intro/closing/footer`) и `conditions`; поддержаны `{{client_name}}`, `{{kp_number}}`, `{{total_price}}`, `{{date}}`, а неизвестные токены остаются в тексте без ошибок.
- KP Builder UX helper: в блоке `Условия` добавлена компактная подсказка «Доступные переменные» с copy-ready токенами для шаблонных текстов.
- KP Builder toolbar redesign: «склад кнопок» заменён на 3-зонный Apple-style toolbar (left/context + center/save-state + right/actions), title input переведён в edit-in-place без постоянной рамки, secondary actions упрощены до ghost-паттерна с hover-фоном, добавлен тонкий визуальный divider перед primary `Сохранить`.
- KP Builder super-refactor (scroll architecture + right pane): устранён сквозной скролл через независимые scroll-контейнеры колонок (`min-height:0`, `overflow-y:auto`, тонкий scrollbar style), правая зона `Состав КП` переведена в горизонтальные item-строки (без чекбоксов, qty-stepper + total, remove по hover), а bulk-наценка/скидка перенесена в нижний блок рядом с итоговой частью.
- KP Builder ultra-clean follow-up: дополнительно удалён «контейнерный шум» в правой панели (`bulk-adjustments` без рамки, более мягкие row/divider линии, condition-template actions в тихом стиле), а вторичные тексты в карточках каталога (`sku/price-label`) приглушены по opacity.
- KP Builder visual de-noise: уменьшен UI-шум (убраны «плашечные» заголовки секций, смягчены разделители/бордеры, сужены боковые панели, центр-документ получил больший приоритет); secondary-кнопки тулбара переведены в более тихий текстовый стиль.
- Catalog/right-panel polish: карточки каталога сделаны легче (мягче тени, компактнее footer, приглушён status-dot), в `Состав КП` сбалансированы размеры фото/названия, bulk-inputs стали компактнее, а кнопки `+/-` получили спокойный iOS-like вид.
- Product form micro-polish: в compact-модалке (`Добавить товар в КП`) смягчены label-стили (normal case), унифицирована высота контролов и фокус переведён на Apple-tone ring (`3px var(--ui-primary-focus)`).
- Product form compact UX fix: в модалке `Добавить товар в КП` убран horizontal overflow — удалён fixed `min-width` строки, сетка переведена на адаптивные `minmax(0, ...)` колонки и добавлены брейкпоинты `2-col/1-col`.
- KP catalog visual upgrade: добавлен standalone dumb-компонент `KpCatalogItemComponent` (`features/kp/components/kp-catalog-item`) в Apple-style эстетике; каталог `KP Builder` переведён на карточки товара с мягкой иерархией типографики, status-dot и micro-interaction кнопкой `Добавить`.
- KP Builder holistic refactor: добавлен локальный `KpBuilderStore`, а `KpBuilderComponent` переведён на store-driven immutable updates (без прямых `kp.set/update` в компоненте).
- Smart/Dumb pass: `KpDocumentComponent` и `KpCatalogComponent` переведены на `ChangeDetectionStrategy.OnPush`; inline price editing стабилизирован через commit/cancel handlers (`blur`/`Enter`/`Escape`).
- Backend architecture pass: создан `backend/src/services/kp.service.ts`, создан `backend/src/controllers/kp.controller.ts`, а `backend/src/routes/kp.routes.ts` упрощён до route wiring + RBAC (бизнес-логика перенесена в service layer).
- UX/Error handling: в `authInterceptor` добавлен явный `400` mapping с приоритетом backend `error.message`, а `5xx` переведён на более дружелюбный user copy без изменения 401 refresh flow.
- Apple shell baseline: обновлены tokens и ключевые KP/UI стили (`kp-builder.layout/sidebar/widgets`, `kp-document`, `kp-catalog`, `button`, `status-badge`, global `focus-visible`) под system-font + glass + soft elevation.

- KP Builder layout polish: завершён token-only pass для layout-слоя — убраны raw `rgba/#fff` в `kp-builder.layout.scss`, inset-разделители переведены на `color-mix` от `--ui-border`, print-background вынесен в `--ui-print-paper`.
- KP Builder P0 cleanup: в sidebar секциях убраны hardcoded цветовые тени/бордеры и переведены на semantic token-подход (`--ui-*` + `color-mix`), а в widgets унифицирована плотность icon-кнопок и добавлен явный focus-visible ring для keyboard-доступности.
- Design System foundations: обновлён `styles/_tokens.scss` (semantic CSS tokens для цветов, типографики, spacing/radius/shadow), глобальные стили переведены на token-first подход, добавлены базовые reset/typography правила и единый focus ring.
- Core UI refactor: `ui-btn` получил варианты `primary/secondary/ghost` (с сохранением `danger` для обратной совместимости), унифицированные состояния `hover/active/focus-visible/disabled`; `ui-form-field` переведён на BEM `ui-form-field__*` и token-driven состояния.
- UI primitives: добавлен `ui-card` как базовая surface-компонента; подготовлен `DESIGN_SYSTEM.md` с палитрой, типографикой, гайдами использования и P0 cleanup-планом для `KP Builder`.
- Deploy UX: добавлен wrapper `deploy/deploy` для запуска одной командой `./deploy`; `deploy.sh` автоматически очищает `backend/dist` перед проверкой dirty-tree, чтобы generated build-файлы не стопорили `git pull`.
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


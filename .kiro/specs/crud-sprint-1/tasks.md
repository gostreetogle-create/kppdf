# Tasks — crud-sprint-1

## Task List

- [x] 1. Миграция AppShellComponent на левый сайдбар
  - [x] 1.1 Заменить `<header class="shell-header">` на `<aside class="sidebar no-print">` в шаблоне
  - [x] 1.2 Добавить сигнал `sidebarOpen = signal(false)` и метод `toggleSidebar()` в класс компонента
  - [x] 1.3 Добавить nav-ссылки: КП (`/`), Товары (`/products`), Контрагенты (`/counterparties`), Настройки (`/settings`)
  - [x] 1.4 Добавить brand "КП PDF" вверху и блок user+logout внизу сайдбара
  - [x] 1.5 Добавить кнопку мобильного toggle (`.sidebar-toggle`) с обработчиком `toggleSidebar()`
  - [x] 1.6 Переписать SCSS: удалить `.shell-header`, добавить `.sidebar` (240px, flex column, sticky), `.shell-layout` (flex row), `.sidebar-toggle` (скрыт на десктопе), медиа-запрос `@media (max-width: 767px)` для collapse
  - [x] 1.7 Убедиться что `no-print` класс на сайдбаре сохранён, `<app-toast />` остался в шаблоне
  - [x] 1.8 Убедиться что `.shell-content` занимает оставшееся пространство (`flex: 1`)

- [x] 2. Маршрут /counterparties в app.routes.ts
  - [x] 2.1 Добавить дочерний маршрут `counterparties` → `CounterpartiesComponent` с `authGuard` (наследуется от родителя)

- [x] 3. CounterpartyTableComponent (dumb)
  - [x] 3.1 Создать файлы `frontend/src/app/features/counterparties/components/counterparty-table/counterparty-table.component.{ts,html,scss}`
  - [x] 3.2 Объявить `counterparties = input.required<Counterparty[]>()`, `edit = output<Counterparty>()`, `delete = output<Counterparty>()`
  - [x] 3.3 Реализовать таблицу с колонками: Название, ИНН, Роль (BadgeComponent), Статус (BadgeComponent), Орг. форма, Действия (кнопки "Изменить" / "Удалить")
  - [x] 3.4 Импортировать `BadgeComponent`, `ButtonComponent` из `shared/ui`

- [x] 4. CounterpartyFormComponent (dumb)
  - [x] 4.1 Создать файлы `frontend/src/app/features/counterparties/components/counterparty-form/counterparty-form.component.{ts,html,scss}`
  - [x] 4.2 Объявить `counterparty = input<Counterparty | null>(null)`, `saved = output<Counterparty>()`, `cancelled = output<void>()`
  - [x] 4.3 Объявить внутренние signals: `saving`, `lookingUp`, `formError`
  - [x] 4.4 Реализовать интерфейс `CounterpartyFormModel` и инициализацию формы из `counterparty()` при наличии (edit mode)
  - [x] 4.5 Добавить все поля формы: legalForm, role (checkboxes), name, shortName, inn + кнопка "Найти по ИНН", kpp, ogrn, legalAddress, actualAddress, sameAddress (checkbox), phone, email, website, bankName, bik, checkingAccount, correspondentAccount, founderName, founderNameShort, status, notes, tags
  - [x] 4.6 Реализовать метод `validate()`: обязательные поля legalForm, name, inn, status, role (хотя бы одна роль)
  - [x] 4.7 Реализовать метод `submit()`: вызов `createCounterparty()` или `updateCounterparty()` в зависимости от режима, emit `saved` при успехе, установка `formError` при ошибке
  - [x] 4.8 Реализовать метод `lookupByInn()`: вызов `ApiService.lookupCounterpartyByInn()`, патч только присутствующих полей, обработка 404 и других ошибок
  - [x] 4.9 Использовать `takeUntilDestroyed()` для всех подписок
  - [x] 4.10 Обернуть форму в `ModalComponent`, добавить `AlertComponent` для `formError`
  - [x] 4.11 Импортировать `ModalComponent`, `FormFieldComponent`, `AlertComponent`, `ButtonComponent` из `shared/ui`

- [x] 5. CounterpartiesComponent (smart)
  - [x] 5.1 Создать файлы `frontend/src/app/features/counterparties/counterparties.component.{ts,html,scss}`
  - [x] 5.2 Объявить signals: `counterparties`, `loading`, `error`, `search`, `filterRole`, `filterStatus`, `formOpen`, `editTarget`, `deleteTarget`
  - [x] 5.3 Реализовать `ngOnInit()`: начальная загрузка через `ApiService.getCounterparties()`
  - [x] 5.4 Реализовать реактивный поиск и фильтрацию: `toObservable()` на сигналах search/filterRole/filterStatus → `combineLatest` → `debounceTime(300)` → `ApiService.getCounterparties({ q, role, status })`
  - [x] 5.5 Реализовать методы: `openCreate()`, `openEdit(cp)`, `closeForm()`, `onSaved(cp)`, `confirmDelete(cp)`, `onDeleteConfirmed()`, `onDeleteCancelled()`
  - [x] 5.6 В `onSaved()`: добавить в список (create) или заменить по `_id` (edit), закрыть форму
  - [x] 5.7 В `onDeleteConfirmed()`: вызов `deleteCounterparty()`, удаление из списка при успехе, `NotificationService.error()` при ошибке
  - [x] 5.8 Использовать `takeUntilDestroyed()` для всех подписок
  - [x] 5.9 Реализовать шаблон: заголовок + кнопка "Создать", поле поиска, select фильтр роли, select фильтр статуса, `CounterpartyTableComponent`, `CounterpartyFormComponent` (при `formOpen()`), `ConfirmDialogComponent` (при `deleteTarget()`)
  - [x] 5.10 Отображать `AlertComponent` при `error()`, loading-индикатор при `loading()`, empty-state при пустом списке
  - [x] 5.11 Импортировать `CounterpartyTableComponent`, `CounterpartyFormComponent`, `ConfirmDialogComponent`, `AlertComponent`, `ButtonComponent`
  - [x] 5.12 Инжектировать `NotificationService`

- [ ] 6. Ручная проверка
  - [ ] 6.1 Проверить навигацию по всем маршрутам через сайдбар (/, /products, /counterparties, /settings)
  - [ ] 6.2 Проверить мобильный collapse сайдбара при ширине < 768px
  - [ ] 6.3 Проверить CRUD контрагентов: создание, редактирование, удаление
  - [ ] 6.4 Проверить DaData lookup по ИНН (успех, 404, ошибка)
  - [ ] 6.5 Проверить поиск и фильтрацию с debounce
  - [ ] 6.6 Проверить что `@media print` скрывает сайдбар

- [x] Обновить PROJECT_PASSPORT.md

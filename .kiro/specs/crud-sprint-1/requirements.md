# Requirements Document

## Introduction

Sprint 1 расширяет KP PDF систему двумя фичами: страница управления контрагентами (`/counterparties`) и миграция навигации с горизонтального хедера на левый сайдбар. Backend API и типы уже готовы — реализуется только UI слой. Существующая логика КП (snapshot `Kp.recipient`) и маршруты не затрагиваются.

## Glossary

- **CounterpartiesPage** — страница `/counterparties`, умный компонент, управляет состоянием списка
- **CounterpartyTable** — тупой компонент, отображает список контрагентов в виде таблицы
- **CounterpartyForm** — тупой компонент, модальная форма создания/редактирования контрагента
- **ConfirmDialog** — тупой компонент, диалог подтверждения удаления (переиспользуется из products)
- **AppShell** — корневой layout-компонент, содержит навигацию и `<router-outlet>`
- **Sidebar** — левая панель навигации внутри AppShell
- **ApiService** — единственный HTTP-сервис фронтенда
- **Counterparty** — сущность контрагента (`shared/types/Counterparty.ts`)
- **DaData** — внешний сервис поиска компаний по ИНН (интеграция через `/api/counterparties/lookup`)
- **CpRole** — роль контрагента: `client` | `supplier` (массив, контрагент может иметь обе роли)
- **LegalForm** — организационно-правовая форма: `ООО` | `ИП` | `АО` | `ПАО` | `Физлицо` | `Другое`

---

## Requirements

### Requirement 1: Список контрагентов

**User Story:** As a менеджер, I want to see a list of all counterparties in a table, so that I can quickly find and manage them.

#### Acceptance Criteria

1. THE CounterpartiesPage SHALL load and display all counterparties from `ApiService.getCounterparties()` on initialization.
2. WHILE data is loading, THE CounterpartiesPage SHALL display a loading indicator.
3. THE CounterpartyTable SHALL display each counterparty with columns: name, INN, role (badges), status (badge), legalForm.
4. IF the counterparties list is empty, THEN THE CounterpartiesPage SHALL display a message "Контрагенты не найдены".
5. IF `ApiService.getCounterparties()` returns an error, THEN THE CounterpartiesPage SHALL display an error message via the existing Alert component.

---

### Requirement 2: Поиск и фильтрация

**User Story:** As a менеджер, I want to search and filter counterparties, so that I can quickly find the right one.

#### Acceptance Criteria

1. THE CounterpartiesPage SHALL provide a text input for search by name or INN.
2. WHEN the search input value changes, THE CounterpartiesPage SHALL pass the query to `ApiService.getCounterparties({ q })` and update the displayed list.
3. THE CounterpartiesPage SHALL provide a role filter with options: all, `client`, `supplier`.
4. THE CounterpartiesPage SHALL provide a status filter with options: all, `active`, `inactive`.
5. WHEN a filter value changes, THE CounterpartiesPage SHALL pass the updated params to `ApiService.getCounterparties()` and update the displayed list.
6. WHEN search or filter params change, THE CounterpartiesPage SHALL debounce API calls by at least 300ms to avoid excessive requests.

---

### Requirement 3: Создание контрагента

**User Story:** As a менеджер, I want to create a new counterparty via a modal form, so that I can add clients and suppliers to the system.

#### Acceptance Criteria

1. THE CounterpartiesPage SHALL provide a "Создать" button that opens CounterpartyForm in create mode.
2. THE CounterpartyForm SHALL include fields for all Counterparty properties: legalForm, role, name, shortName, inn, kpp, ogrn, legalAddress, actualAddress, sameAddress, phone, email, website, bankName, bik, checkingAccount, correspondentAccount, founderName, founderNameShort, status, notes, tags.
3. THE CounterpartyForm SHALL mark the following fields as required: legalForm, name, inn, status, role (at least one).
4. WHEN the user submits a valid form in create mode, THE CounterpartyForm SHALL call `ApiService.createCounterparty()` and emit the created Counterparty to the parent.
5. WHEN `ApiService.createCounterparty()` succeeds, THE CounterpartiesPage SHALL add the new counterparty to the list without a full page reload.
6. IF `ApiService.createCounterparty()` returns an error, THEN THE CounterpartyForm SHALL display the error message inside the modal.
7. WHEN the user closes CounterpartyForm, THE CounterpartiesPage SHALL reset the form state.

---

### Requirement 4: Редактирование контрагента

**User Story:** As a менеджер, I want to edit an existing counterparty, so that I can keep their data up to date.

#### Acceptance Criteria

1. THE CounterpartyTable SHALL provide an "Изменить" action for each row that opens CounterpartyForm in edit mode pre-filled with the counterparty's data.
2. WHEN the user submits a valid form in edit mode, THE CounterpartyForm SHALL call `ApiService.updateCounterparty()` and emit the updated Counterparty to the parent.
3. WHEN `ApiService.updateCounterparty()` succeeds, THE CounterpartiesPage SHALL replace the updated counterparty in the list without a full page reload.
4. IF `ApiService.updateCounterparty()` returns an error, THEN THE CounterpartyForm SHALL display the error message inside the modal.

---

### Requirement 5: Удаление контрагента

**User Story:** As a менеджер, I want to delete a counterparty with a confirmation step, so that I don't accidentally remove important data.

#### Acceptance Criteria

1. THE CounterpartyTable SHALL provide a "Удалить" action for each row.
2. WHEN the user clicks "Удалить", THE CounterpartiesPage SHALL open a ConfirmDialog asking the user to confirm deletion.
3. WHEN the user confirms deletion, THE CounterpartiesPage SHALL call `ApiService.deleteCounterparty()`.
4. WHEN `ApiService.deleteCounterparty()` succeeds, THE CounterpartiesPage SHALL remove the counterparty from the list without a full page reload.
5. IF `ApiService.deleteCounterparty()` returns an error, THEN THE CounterpartiesPage SHALL display an error notification via NotificationService.
6. WHEN the user cancels the ConfirmDialog, THE CounterpartiesPage SHALL close the dialog and take no further action.

---

### Requirement 6: DaData автозаполнение по ИНН

**User Story:** As a менеджер, I want to look up a company by INN and auto-fill the form, so that I don't have to type all the details manually.

#### Acceptance Criteria

1. THE CounterpartyForm SHALL provide an "Найти по ИНН" button adjacent to the INN field.
2. WHEN the user clicks "Найти по ИНН" with a non-empty INN value, THE CounterpartyForm SHALL call `ApiService.lookupCounterpartyByInn(inn)`.
3. WHILE the DaData lookup is in progress, THE CounterpartyForm SHALL disable the lookup button and show a loading state.
4. WHEN `ApiService.lookupCounterpartyByInn()` succeeds, THE CounterpartyForm SHALL populate all returned fields (legalForm, name, shortName, kpp, ogrn, legalAddress, status, founderName, founderNameShort) without overwriting fields not present in the response.
5. IF `ApiService.lookupCounterpartyByInn()` returns a 404, THEN THE CounterpartyForm SHALL display the message "Компания не найдена по указанному ИНН".
6. IF `ApiService.lookupCounterpartyByInn()` returns any other error, THEN THE CounterpartyForm SHALL display the message "Ошибка при запросе к DaData".

---

### Requirement 7: Маршрут /counterparties

**User Story:** As a менеджер, I want to navigate to the counterparties page via a URL, so that I can bookmark and share the link.

#### Acceptance Criteria

1. THE AppShell SHALL register the route `/counterparties` mapped to CounterpartiesPage, protected by `authGuard`.
2. WHEN an unauthenticated user navigates to `/counterparties`, THE AppShell SHALL redirect to `/login`.
3. THE AppShell SHALL add `/counterparties` to the Sidebar navigation with the label "Контрагенты".

---

### Requirement 8: Миграция навигации на левый сайдбар

**User Story:** As a пользователь, I want a left sidebar for navigation, so that I have more vertical space for content and a familiar admin layout.

#### Acceptance Criteria

1. THE AppShell SHALL replace the current top horizontal navigation header with a left Sidebar.
2. THE Sidebar SHALL contain navigation links: КП (`/`), Товары (`/products`), Контрагенты (`/counterparties`), Настройки (`/settings`).
3. THE Sidebar SHALL display the active link with a distinct visual style using existing design tokens.
4. THE Sidebar SHALL display the application brand label "КП PDF" at the top.
5. THE Sidebar SHALL display the current user's name and a "Выйти" button at the bottom.
6. THE AppShell SHALL preserve the `<app-toast />` component in the layout.
7. THE AppShell SHALL preserve the `no-print` CSS class behavior so the Sidebar is hidden during printing.
8. WHILE the viewport width is less than 768px, THE Sidebar SHALL collapse to a hidden state by default.
9. WHEN the user taps the mobile menu toggle on a viewport narrower than 768px, THE Sidebar SHALL toggle between visible and hidden states.
10. THE AppShell SHALL NOT change any existing route paths (`/`, `/products`, `/settings`, `/kp/:id`).

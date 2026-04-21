# Design Document — crud-sprint-1

## Overview

Sprint 1 добавляет два независимых UI-слоя поверх уже готового backend API:

1. **Страница контрагентов** (`/counterparties`) — полный CRUD с поиском, фильтрацией, модальной формой и DaData-автозаполнением.
2. **Миграция навигации** — замена горизонтального хедера на левый сайдбар 240px с мобильным collapse.

Backend API, типы (`shared/types/Counterparty.ts`) и `ApiService` уже реализованы и не изменяются. Существующая snapshot-логика `Kp.recipient` не затрагивается.

---

## Architecture

Следуем существующему паттерну из `features/products`:

- **Smart component** (страница) — управляет состоянием через Angular Signals, вызывает `ApiService`, обрабатывает события дочерних компонентов.
- **Dumb components** (таблица, форма) — получают данные через `input()`, эмитят события через `output()`, не знают об `ApiService`.
- Все подписки через `takeUntilDestroyed()`.
- HTTP-запросы только через `ApiService` — единственный HTTP-сервис.
- Уведомления через `NotificationService`.

```
AppShellComponent (modified)
└── Sidebar (inline in AppShell template)
    └── router-outlet
        └── CounterpartiesComponent (smart, /counterparties)
            ├── CounterpartyTableComponent (dumb)
            ├── CounterpartyFormComponent (dumb, modal)
            └── ConfirmDialogComponent (reused from products)
```

---

## Components and Interfaces

### AppShellComponent (modified)

**Файл:** `frontend/src/app/core/components/app-shell/app-shell.component.*`

Заменяем `<header class="shell-header">` на `<aside class="sidebar">`. Добавляем сигнал `sidebarOpen = signal(false)` для мобильного toggle.

```typescript
sidebarOpen = signal(false);
toggleSidebar() { this.sidebarOpen.update(v => !v); }
```

Шаблон:
```html
<div class="shell-layout">
  <aside class="sidebar no-print" [class.sidebar--open]="sidebarOpen()">
    <div class="sidebar__brand">КП PDF</div>
    <nav class="sidebar__nav"><!-- links --></nav>
    <div class="sidebar__footer"><!-- user + logout --></div>
  </aside>
  <button class="sidebar-toggle no-print" (click)="toggleSidebar()">☰</button>
  <main class="shell-content">
    <router-outlet />
  </main>
</div>
<app-toast />
```

### CounterpartiesComponent (smart)

**Файл:** `frontend/src/app/features/counterparties/counterparties.component.*`

**Маршрут:** `/counterparties`

Signals:
```typescript
counterparties = signal<Counterparty[]>([]);
loading        = signal(false);
error          = signal<string | null>(null);
search         = signal('');
filterRole     = signal<CpRole | ''>('');
filterStatus   = signal<'active' | 'inactive' | ''>('');
formOpen       = signal(false);
editTarget     = signal<Counterparty | null>(null);
deleteTarget   = signal<Counterparty | null>(null);
```

Поиск и фильтрация через `effect()` + `debounceTime(300)` на объединённом потоке параметров → вызов `ApiService.getCounterparties({ q, role, status })`.

### CounterpartyTableComponent (dumb)

**Файл:** `frontend/src/app/features/counterparties/components/counterparty-table/counterparty-table.component.*`

```typescript
counterparties = input.required<Counterparty[]>();
edit           = output<Counterparty>();
delete         = output<Counterparty>();
```

Колонки таблицы: Название, ИНН, Роль (badges), Статус (badge), Орг. форма, Действия.

### CounterpartyFormComponent (dumb)

**Файл:** `frontend/src/app/features/counterparties/components/counterparty-form/counterparty-form.component.*`

```typescript
counterparty = input<Counterparty | null>(null);  // null = create mode
saved        = output<Counterparty>();
cancelled    = output<void>();
```

Внутренние signals:
```typescript
saving      = signal(false);
lookingUp   = signal(false);
formError   = signal<string | null>(null);
```

Форма через `FormsModule` (template-driven, как в `product-form`). DaData lookup — кнопка рядом с полем ИНН, вызывает `ApiService.lookupCounterpartyByInn()`, патчит форму только присутствующими полями.

### ConfirmDialogComponent (reused)

Переиспользуется без изменений из `features/products/components/confirm-dialog/`.

---

## Data Models

Используем существующий тип `Counterparty` из `shared/types/Counterparty.ts` и `ApiService`. Новых типов не вводим.

Внутренний интерфейс формы:

```typescript
interface CounterpartyFormModel {
  legalForm:             LegalForm;
  role:                  CpRole[];
  name:                  string;
  shortName:             string;
  inn:                   string;
  kpp:                   string;
  ogrn:                  string;
  legalAddress:          string;
  actualAddress:         string;
  sameAddress:           boolean;
  phone:                 string;
  email:                 string;
  website:               string;
  bankName:              string;
  bik:                   string;
  checkingAccount:       string;
  correspondentAccount:  string;
  founderName:           string;
  founderNameShort:      string;
  status:                'active' | 'inactive';
  notes:                 string;
  tags:                  string;  // comma-separated string → split to string[] on submit
}
```

Маппинг `tags`: в форме — строка через запятую, при сабмите — `split(',').map(t => t.trim()).filter(Boolean)`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Список контрагентов отображается полностью

*For any* массив контрагентов, возвращённых `ApiService.getCounterparties()`, каждый контрагент должен присутствовать в таблице, и количество строк таблицы должно равняться длине массива.

**Validates: Requirements 1.1, 1.3**

### Property 2: Строка таблицы содержит все обязательные поля

*For any* объекта `Counterparty`, отрендеренная строка таблицы должна содержать: `name`, `inn`, хотя бы один role-badge, status-badge и `legalForm`.

**Validates: Requirements 1.3**

### Property 3: Поиск передаёт параметр q в API

*For any* непустой строки поиска, введённой в поле поиска, `ApiService.getCounterparties()` должен быть вызван с параметром `{ q: searchString }` после debounce 300ms.

**Validates: Requirements 2.2, 2.6**

### Property 4: Фильтры передают корректные параметры в API

*For any* комбинации значений фильтров role и status, `ApiService.getCounterparties()` должен быть вызван с соответствующими параметрами `{ role, status }`.

**Validates: Requirements 2.3, 2.4, 2.5**

### Property 5: Валидация формы отклоняет неполные данные

*For any* набора данных формы, в котором отсутствует хотя бы одно из обязательных полей (legalForm, name, inn, status, role), сабмит формы должен быть отклонён и `ApiService.createCounterparty()` не должен вызываться.

**Validates: Requirements 3.3**

### Property 6: Создание контрагента добавляет его в список

*For any* валидного объекта `Counterparty`, возвращённого `ApiService.createCounterparty()`, он должен появиться в сигнале `counterparties` без перезагрузки страницы, и длина списка должна увеличиться на 1.

**Validates: Requirements 3.4, 3.5**

### Property 7: Редактирование заменяет контрагента в списке

*For any* обновлённого объекта `Counterparty`, возвращённого `ApiService.updateCounterparty()`, в сигнале `counterparties` должна присутствовать ровно одна запись с данным `_id`, содержащая обновлённые данные.

**Validates: Requirements 4.2, 4.3**

### Property 8: Удаление убирает контрагента из списка

*For any* контрагента в списке, после успешного вызова `ApiService.deleteCounterparty()` этот контрагент не должен присутствовать в сигнале `counterparties`.

**Validates: Requirements 5.3, 5.4**

### Property 9: DaData lookup патчит только присутствующие поля

*For any* частичного ответа `Partial<Counterparty>` от `ApiService.lookupCounterpartyByInn()`, форма должна обновить только те поля, которые присутствуют в ответе, оставив остальные поля без изменений.

**Validates: Requirements 6.4**

### Property 10: Закрытие формы сбрасывает состояние

*For any* состояния формы (create или edit, с любыми введёнными данными), после закрытия формы сигналы `formOpen`, `editTarget` должны вернуться в исходное состояние (`false`, `null`).

**Validates: Requirements 3.7**

---

## Error Handling

| Сценарий | Обработка |
|----------|-----------|
| `getCounterparties()` error | `error` signal → `<app-alert>` на странице |
| `createCounterparty()` error | `formError` signal → сообщение внутри модала |
| `updateCounterparty()` error | `formError` signal → сообщение внутри модала |
| `deleteCounterparty()` error | `NotificationService.error()` → toast |
| `lookupCounterpartyByInn()` 404 | Сообщение "Компания не найдена по указанному ИНН" в форме |
| `lookupCounterpartyByInn()` другая ошибка | Сообщение "Ошибка при запросе к DaData" в форме |

Все ошибки HTTP приходят через `ApiService` → Angular `HttpClient` → `error` callback подписки.

---

## Testing Strategy

### Unit / Example-based tests

Покрывают конкретные сценарии и граничные случаи:

- Загрузка: индикатор загрузки показан пока API не ответил
- Пустой список: отображается сообщение "Контрагенты не найдены"
- Ошибка загрузки: `AlertComponent` отображается
- Кнопка "Создать" открывает форму в create mode
- Кнопка "Изменить" открывает форму в edit mode с предзаполненными данными
- Кнопка "Удалить" открывает `ConfirmDialog`
- Отмена `ConfirmDialog` не вызывает API
- Ошибка create/update показывает сообщение внутри модала
- Ошибка delete показывает toast через `NotificationService`
- DaData: кнопка задизейблена во время запроса
- DaData 404: специфическое сообщение
- DaData другая ошибка: специфическое сообщение
- Sidebar: все 4 nav-ссылки присутствуют
- Sidebar: активная ссылка имеет класс `active`
- Sidebar: brand "КП PDF" отображается
- Sidebar: имя пользователя и кнопка "Выйти" в footer
- Sidebar: `app-toast` присутствует в шаблоне
- Mobile: sidebar скрыт по умолчанию при ширине < 768px
- Mobile: toggle показывает/скрывает sidebar

### Property-based tests

Используем **fast-check** (уже доступен в экосистеме Angular/Jest).
Каждый тест запускается минимум **100 итераций**.
Тег формата: `// Feature: crud-sprint-1, Property N: <text>`

| Property | Что генерируем | Что проверяем |
|----------|---------------|---------------|
| P1: Список отображается полностью | `fc.array(arbitraryCounterparty())` | `rows.length === input.length` |
| P2: Строка содержит все поля | `arbitraryCounterparty()` | name, inn, role badges, status badge, legalForm присутствуют |
| P3: Поиск передаёт q | `fc.string({ minLength: 1 })` | API вызван с `{ q }` после debounce |
| P4: Фильтры передают параметры | `fc.record({ role, status })` | API вызван с корректными params |
| P5: Валидация отклоняет неполные данные | форма с одним пустым обязательным полем | API не вызван |
| P6: Создание добавляет в список | `arbitraryCounterparty()` | список вырос на 1, содержит новый элемент |
| P7: Редактирование заменяет в списке | `arbitraryCounterparty()` + изменения | список содержит ровно 1 запись с данным `_id` с новыми данными |
| P8: Удаление убирает из списка | `arbitraryCounterparty()` в списке | список не содержит удалённый `_id` |
| P9: DaData патчит только присутствующие поля | `fc.record(...)` с произвольным подмножеством полей | только присутствующие поля изменились |
| P10: Закрытие сбрасывает состояние | любое состояние формы | `formOpen=false`, `editTarget=null` |

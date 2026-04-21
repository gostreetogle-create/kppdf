# Design Document — crud-sprint-1

## Overview

Sprint 1 добавляет два UI-слоя поверх backend API:

1. Страница контрагентов (`/counterparties`) с CRUD, поиском, фильтрацией, модальной формой и DaData-автозаполнением.
2. Миграция навигации с горизонтального хедера на левый сайдбар 240px с мобильным collapse.

Backend API, типы и `ApiService` не изменяются.

## Architecture

Следуем существующему паттерну:
- Smart component управляет состоянием через Angular Signals.
- Dumb components получают `input()` и эмитят `output()`.
- Все подписки через `takeUntilDestroyed()`.
- HTTP только через `ApiService`.
- Уведомления через `NotificationService`.

```
AppShellComponent
└── Sidebar
    └── router-outlet
        └── CounterpartiesComponent (smart)
            ├── CounterpartyTableComponent (dumb)
            ├── CounterpartyFormComponent (dumb)
            └── ConfirmDialogComponent (reused)
```

## Components and Interfaces

- `AppShellComponent`: sidebar + `sidebarOpen = signal(false)` + `toggleSidebar()`.
- `CounterpartiesComponent`: сигналы списка/фильтров/модалок, реактивная загрузка с debounce 300ms.
- `CounterpartyTableComponent`: рендер списка и действия edit/delete.
- `CounterpartyFormComponent`: create/edit + lookup по ИНН, валидация обязательных полей.
- `ConfirmDialogComponent`: переиспользование без изменений.

## Data Model Notes

Используется `Counterparty` из `shared/types/Counterparty.ts`.
Новые типы домена не вводятся.

## Correctness Properties (кратко)

1. Таблица рендерит весь массив контрагентов.
2. Каждая строка содержит обязательные поля.
3. Поиск передаёт `q` в API после debounce.
4. Фильтры передают корректные `role/status`.
5. Невалидная форма не вызывает create/update.
6. Create добавляет элемент в список без reload.
7. Update заменяет элемент по `_id`.
8. Delete удаляет элемент из списка.
9. DaData патчит только присутствующие поля.
10. Закрытие формы сбрасывает состояние.

## Error Handling

- Ошибка загрузки списка -> `AlertComponent`.
- Ошибки create/update -> сообщение в модале.
- Ошибка delete -> `NotificationService.error()`.
- Ошибки DaData -> специализированные сообщения для 404 и общего случая.

## Testing Strategy (кратко)

- Unit/smoke: загрузка, empty/error states, create/edit/delete, debounce filters, DaData сценарии.
- Property-based (fast-check): валидация свойств P1-P10.

Источник полного документа: `.kiro/specs/crud-sprint-1/design.md`.

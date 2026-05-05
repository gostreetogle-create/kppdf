# Архитектура

## Структура проекта

```
kppdf/
├── backend/                  # Express API
│   └── src/
│       ├── controllers/      # Контроллеры (с маппингом в DTO)
│       ├── dtos/             # Data Transfer Objects (синхронизация с shared)
│       ├── models/           # Mongoose-схемы (Product, Kp)
│       ├── routes/           # REST-роуты (/api/products, /api/kp)
│       └── app.ts            # Точка входа, подключение к MongoDB
├── shared/                   # Общий код для frontend и backend
│   ├── types/                # Canonical TypeScript interfaces
│   └── utils/                # Общая бизнес-логика (price calculation и др.)
├── frontend/                 # Angular 19 SPA
│   └── src/
│       ├── styles/           # Design tokens, глобальные стили
│       └── app/
│           ├── core/         # ApiService
│           ├── features/     # Страницы (smart-компоненты)
│           │   ├── home/     # Список КП
│           │   ├── kp/       # Редактор КП + компоненты документа A4
│           │   └── products/ # Каталог товаров
│           └── shared/ui/    # UI kit (dumb-компоненты)
├── deploy/                   # Docker-файлы, nginx, скрипт деплоя
├── docker-compose.yml        # MongoDB для локальной разработки
└── docs/                     # Документация
```

---

## Роуты Angular

| URL         | Компонент            | Описание                    |
|-------------|----------------------|-----------------------------|
| `/`         | `HomeComponent`      | Список всех КП              |
| `/products` | `ProductsComponent`  | Каталог товаров (CRUD)      |
| `/counterparties` | `CounterpartiesComponent` | Контрагенты (CRUD + фильтры + DaData lookup) |
| `/settings` | `SettingsComponent`  | Глобальные настройки КП     |
| `/dictionaries` | `DictionariesComponent` | Справочники (CRUD)          |
| `/kp/:id`   | `KpBuilderComponent` | Редактор КП                 |
| `/login`    | `LoginComponent`     | Авторизация                 |

Все роуты — lazy-loaded (`loadComponent`).

---

## Smart / Dumb компоненты

**Правило:** smart компоненты знают об `ApiService` и управляют состоянием. Dumb — только `input()` / `output()`, никаких сервисов.

### Smart (контейнеры)

| Компонент            | Ответственность                                       |
|----------------------|-------------------------------------------------------|
| `HomeComponent`      | Загрузка списка КП, создание нового, удаление         |
| `ProductsComponent`  | CRUD товаров, поиск, переключение вида, bulk import JSON |
| `CounterpartiesComponent` | CRUD контрагентов, поиск/фильтры, модальные формы |
| `SettingsComponent`  | Редактирование настроек КП (`Settings`)               |
| `DictionariesComponent` | CRUD элементов справочников (`category/subcategory/unit/kind`) |
| `KpBuilderComponent` | Загрузка КП и каталога, добавление/удаление позиций, сохранение |

### Dumb (презентационные)

| Компонент               | Описание                                         |
|-------------------------|--------------------------------------------------|
| `KpDocumentComponent`   | Рендер документа A4, разбивка на страницы        |
| `KpBackgroundComponent` | Обёртка с фоновым изображением страницы A4       |
| `KpHeaderComponent`     | Шапка КП: получатель + метаданные                |
| `KpCatalogComponent`    | Таблица позиций КП                               |
| `KpTableComponent`      | Итоги и условия                                  |
| `ProductCardComponent`  | Карточка товара (вид сетки)                      |
| `ProductFormComponent`  | Модальная форма создания/редактирования товара   |
| `ConfirmDialogComponent`| Диалог подтверждения удаления                    |

---

## UI Kit (`shared/ui/`)

Переиспользуемые примитивы без бизнес-логики. Подробнее: [ui-kit.md](./ui-kit.md)

| Компонент          | Селектор               | Описание                          |
|--------------------|------------------------|-----------------------------------|
| `ButtonComponent`  | `button[ui-btn]`, `a[ui-btn]` | Кнопка с вариантами и размерами |
| `BadgeComponent`   | `<ui-badge>`           | Цветной бейдж для статусов        |
| `ModalComponent`   | `<ui-modal>`           | Модальное окно со слотами         |
| `FormFieldComponent`| `<ui-form-field>`     | Обёртка поля формы с label/error  |
| `EmptyStateComponent`| `<ui-empty-state>`    | Состояние пустого списка/поиска   |
| `AlertComponent`   | `<ui-alert>`           | Блок уведомления                  |

---

## Реактивность

Проект использует **Angular Signals** (Angular 17+). Никаких `BehaviorSubject` / `Subject` для состояния компонентов.

| Паттерн                 | Где используется                                      |
|-------------------------|-------------------------------------------------------|
| `signal()`              | Локальное состояние: `kpList`, `products`, `loading`  |
| `computed()`            | Производные данные: `filtered`, `catalogItems`, `total` |
| `input()` / `output()`  | Все dumb-компоненты                                   |
| `takeUntilDestroyed()`  | Все HTTP-подписки в smart-компонентах                 |
| `shareReplay(1)`        | Кэш списка товаров в `ApiService`                     |

**Правило иммутабельности** — при изменении вложенных данных сигнала всегда создавать новый объект:

```typescript
// ✅ правильно
this.kp.set({
  ...kp,
  items: kp.items.map(i =>
    i.productId === id ? { ...i, qty } : i
  )
});

// ❌ неправильно — мутация не триггерит обновление
kp.items[0].qty = 5;
this.kp.set(kp);
```

### Angular standalone checklist (DoD)

Перед завершением UI-задач:
- каждый компонент/директива/pipe из шаблона добавлен в `@Component.imports` (для standalone);
- не используются нативные браузерные диалоги для прод-UX (`alert/confirm/prompt`);
- `npx tsc --noEmit` в `frontend` проходит без ошибок;
- если добавлен новый диалог — предпочтительно `ui-modal` из `shared/ui`.

---

## ApiService (`core/services/api.service.ts`)

Единственный сервис для HTTP. Все компоненты работают только через него.

- Список товаров кэшируется через `shareReplay(1)`
- После `create/update/delete/bulk import` товара кэш инвалидируется — следующий `getProducts()` делает новый запрос
- Базовый URL: `http://localhost:3000/api` (локально) / через nginx `/api/` (продакшн)

---

## KP Document — многостраничность

`KpDocumentComponent` автоматически разбивает список позиций на страницы через `computed()`:

- Страница 1: фон `kp-1str.png` + `KpHeaderComponent` (получатель + метаданные)
- Страницы 2+: фон `kp-2str.png`, без шапки, `margin-top: 20mm`
- Последняя страница: `KpTableComponent` (итоги + условия)
- Номера страниц — если страниц > 1
- `itemsPerPage` — `input()`, по умолчанию 10

---

## Тесты

```bash
cd frontend
npx ng test --no-watch --browsers=ChromeHeadless
```

| Файл                          | Что покрыто                                    |
|-------------------------------|------------------------------------------------|
| `api.service.spec.ts`         | Базовые HTTP-методы для products/kp (см. актуальные тесты в файле) |
| `home.component.spec.ts`      | Загрузка, расчёт итогов, статусы, удаление     |
| `products.component.spec.ts`  | CRUD, поиск, фильтрация, переключение вида     |
| `button.component.spec.ts`    | Варианты, размеры, icon-режим                  |
| `badge.component.spec.ts`     | Все цвета                                      |

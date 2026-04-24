# UI Kit

Все компоненты в `frontend/src/app/shared/ui/`.  
Импорт: `import { ButtonComponent, ... } from '../../shared/ui/index'`.

---

## ButtonComponent

**Селектор:** `button[ui-btn]`, `a[ui-btn]`

Актуальный visual baseline: Apple-like controls (system stack через `--ui-font-family`, радиусы `--ui-radius-*`, `:active` scale `0.97`, единый `--ui-focus-ring-shadow`).

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `variant` | `default\|primary\|secondary\|danger\|ghost` | `default` | Стиль |
| `size` | `sm\|md\|lg` | `md` | Размер |
| `icon` | boolean | `false` | Квадратная иконка-кнопка |

```html
<button ui-btn variant="primary">Сохранить</button>
<button ui-btn variant="secondary">Черновик</button>
<button ui-btn variant="danger" size="sm">Удалить</button>
<button ui-btn icon (click)="close()">✕</button>
<a routerLink="/" ui-btn>← Назад</a>
<button ui-btn [disabled]="saving()">{{ saving() ? '...' : 'OK' }}</button>
```

---

## BadgeComponent

**Селектор:** `<ui-badge>`

| Input | Тип | Default |
|-------|-----|---------|
| `color` | `default\|blue\|green\|red\|orange` | `default` |

```html
<ui-badge color="blue">Отправлен</ui-badge>
<ui-badge color="green">Принят</ui-badge>
<ui-badge color="red">Отклонён</ui-badge>
```

---

## StatusBadgeComponent

**Селектор:** `<ui-status-badge>`

Visual baseline: compact Apple-style semantic badge (soft background через `color-mix`, pill `999px`, token-driven semantic colors).

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `variant` | `draft\|sent\|accepted\|rejected\|active\|inactive\|owner\|admin\|manager\|viewer\|client\|supplier\|company` | — | Семантический тип бейджа |
| `label` | `string` | `''` | Переопределение текста |
| `hint` | `string` | `''` | Tooltip (`title`) с пояснением |

```html
<ui-status-badge variant="draft"></ui-status-badge>
<ui-status-badge variant="manager"></ui-status-badge>
<ui-status-badge variant="active" hint="Пользователь может входить в систему"></ui-status-badge>
```

Использование по экранам:
- `Home` и `KP Builder` — статусы КП;
- `Users` — роли и `active/inactive`;
- `Counterparties` — `role[]` и статус контрагента.

---

## ModalComponent

**Селектор:** `<ui-modal>`

| Input | Default | Output |
|-------|---------|--------|
| `title: string` | `''` | `closed` — клик ✕ или backdrop |
| `maxWidth: string` | `'540px'` | |

Слоты: `modal-body`, `modal-footer`

```html
<ui-modal title="Заголовок" (closed)="close()">
  <div modal-body>Содержимое</div>
  <ng-container modal-footer>
    <button ui-btn (click)="close()">Отмена</button>
    <button ui-btn variant="primary" (click)="save()">Сохранить</button>
  </ng-container>
</ui-modal>
```

Подтверждения, влияющие на UX (уход со страницы, разрушительные действия): предпочтительно `ui-modal` + кнопки kit, не `window.confirm` / нативные диалоги браузера (см. `KpBuilderComponent` + `canDeactivateBuilder`).

### ModalService confirm flow

**Сервис:** `frontend/src/app/core/services/modal.service.ts`  
**Host-компонент:** `frontend/src/app/core/components/modal-confirm/modal-confirm.component.ts`  
`ModalConfirmComponent` подключён в `AppShellComponent`, поэтому confirm-модалка доступна глобально.

```typescript
private modal = inject(ModalService);

this.modal.confirm({
  title: 'Удаление записи',
  message: 'Удалить запись?',
  confirmText: 'Удалить',
  cancelText: 'Отмена',
  type: 'danger'
}).subscribe((confirmed) => {
  if (!confirmed) return;
  // destructive action
});
```

Если `type` не передан, confirm-кнопка в host-компоненте использует безопасный fallback `primary` для строгой template-типизации.

Правила качества для новых экранов:
- Не использовать `window.alert`, `window.confirm`, `window.prompt` в прод-UX.
- Для standalone-компонентов Angular: если в шаблоне используется `<ui-modal>`, `ModalComponent` обязан быть в `@Component.imports`.
- Для длинных инструкций в модалке использовать форматированный блок `<pre><code>` + кнопку копирования, не системные алерты.

---

## FormFieldComponent

**Селектор:** `<ui-form-field>`  
Стилизует вложенные `input`, `textarea`, `select` через `::ng-deep` и синхронизирован с глобальным `.form-control` контрактом (`appearance:none`, `--ui-control-height`, `--ui-bg-card`, `--ui-border`, focus ring).

| Input | Default | Описание |
|-------|---------|----------|
| `label: string` | `''` | Метка |
| `required: boolean` | `false` | Красная звёздочка через `.ui-required::after` |
| `error: string` | `''` | Ошибка под полем |
| `hint: string` | `''` | Подсказка под полем |
| `control: AbstractControl \| null` | `null` | Источник автоматических ошибок (`required/email/minlength/...`) |
| `submitted: boolean` | `false` | Показывать ошибки до `touched/dirty` (например, после submit) |

```html
<ui-form-field label="Название" [required]="true" [error]="errors.name">
  <input type="text" [(ngModel)]="form.name" />
</ui-form-field>
```

Error-state:
- при `error` или auto-error контролы внутри `ui-form-field` получают `border-color: var(--ui-danger)`;
- текст ошибки рендерится размером `12px` и цветом `var(--ui-danger)`.
- если `error` передан вручную, он имеет приоритет над auto-map.
- auto-map покрывает ключи Angular: `required`, `email`, `minlength`, `pattern` с лаконичными RU-текстами.

---

## EmptyStateComponent

**Селектор:** `<ui-empty-state>`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `compact` | `boolean` | `false` | Компактный режим |
| `tone` | `'default' \| 'muted'` | `'default'` | Тон визуального блока |

Слоты:
- `[empty-icon]`
- `[empty-title]`
- `[empty-description]`
- `[empty-actions]`
- default content

---

## PageLayout / PageHeader

**Селекторы:** `<ui-page-layout>`, `<ui-page-header>`

`ui-page-layout`:
- Input: `maxWidth?: string`
- Slots: `[page-header]`, `[page-toolbar]`, default content

`ui-page-header`:
- Slots: `[page-title]`, `[page-subtitle]`, `[page-actions]`

Назначение: убрать повторяющийся каркас `page/page-header/page-toolbar` на feature-экранах без изменения бизнес-логики.

---

## Counterparty Form Pattern

Файл: `frontend/src/app/shared/components/counterparty-form/counterparty-form.component.*`

- Для `legalForm = "Физлицо"` использовать компактный сценарий ввода (минимальный набор полей) и скрывать расширенные реквизиты за кнопкой «Показать дополнительные поля».
- В режиме `Физлицо` базовые поля именуются как `ФИО` и `Короткое имя`, placeholder ИНН — `12 цифр` (без юридических шаблонов вида `ООО "..."`).
- Если `shortName` не введён, перед submit применяется fallback `shortName = name` (чтобы UX не расходился с backend-валидацией).
- Роль `company` в режиме `Физлицо` не показывается в UI.

---

## SearchInputComponent

**Селектор:** `<ui-search-input>`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `value` | `string` | `''` | Текущее значение |
| `placeholder` | `string` | `'Поиск...'` | Текст-подсказка |
| `fullWidth` | `boolean` | `false` | Растянуть на ширину контейнера |
| Output `valueChange` | `string` | — | Изменение текста |

```html
<ui-search-input
  [value]="query()"
  placeholder="Поиск по имени..."
  (valueChange)="query.set($event)"
/>
```

---

Стили:
- контейнер использует `focus-within` с `--ui-focus-ring-shadow`;
- иконка поиска оптически центрирована;
- input использует `.form-control`-совместимый стиль (без hardcoded `#fff/#000`).

---

## FilterSelectComponent
Стили:
- `<select>` использует класс `form-control` + локальные token-driven уточнения;
- hover/focus состояния синхронизированы с глобальным `.form-control`.

---


**Селектор:** `<ui-filter-select>`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `value` | `string` | `''` | Текущее выбранное значение |
| `options` | `{ value, label }[]` | `[]` | Список опций |
| Output `valueChange` | `string` | — | Изменение выбранного значения |

```html
<ui-filter-select
  [value]="status()"
  [options]="[
    { value: '', label: 'Все' },
    { value: 'active', label: 'Активен' }
  ]"
  (valueChange)="status.set($event)"
/>
```

---

## AlertComponent

**Селектор:** `<ui-alert>`

| Input | Default |
|-------|---------|
| `type: error\|success\|warning\|info` | `error` |

```html
<ui-alert type="error">Ошибка сохранения</ui-alert>
<ui-alert type="success">Сохранено</ui-alert>
```

Защита от «пустых полосок»:
- `ui-alert` автоматически скрывается при пустом контенте (`:host:empty`), чтобы не рендерить пустой error/success контейнер;
- перед выводом ошибок в alert рекомендуется фильтровать пустые/whitespace-строки.

---

## Product Form Upload Pattern

Файл: `frontend/src/app/features/products/components/product-form/product-form.component.*`

- Блок загрузки фото в карточке товара оформляется как row-паттерн: label + компактная pseudo-button `Выбрать файл` + однострочный filename с ellipsis.
- Нативный `input[type=file]` скрывается визуально и используется только как технический trigger.
- Для состояния загрузки кнопка переводится в disabled-state без layout shift; имя файла остаётся читаемым в той же строке.
- Для узких экранов row переходит в wrap, сохраняя кликабельность и читаемость.

---

## CardComponent

**Селектор:** `<ui-card>`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `tone` | `default\|muted` | `default` | Тон поверхности |
| `interactive` | `boolean` | `false` | Hover-поведение как interactive-card |

```html
<ui-card>
  <h3>Блок параметров</h3>
  <p>Контент карточки</p>
</ui-card>

<ui-card tone="muted" [interactive]="true">
  <p>Вторичная карточка</p>
</ui-card>
```

Card Apple-depth правила:
- base background: `var(--ui-bg-card)`;
- мягкая baseline-тень и усиление depth на hover для `interactive=true`;
- hover lift: `transform: translateY(-1px)`.

---

## KpCatalogItemComponent

**Селектор:** `<app-kp-catalog-item>`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `product` | `Product` | — | Данные карточки товара |
| `isSelected` | `boolean` | `false` | Подсветка, если товар уже добавлен в КП |
| Output `onAdd` | `Product` | — | Событие добавления товара в КП |

Использование:
```html
<app-kp-catalog-item
  [product]="product"
  [isSelected]="isProductInKp(product)"
  (onAdd)="addItem($event)">
</app-kp-catalog-item>
```

Правило: компонент остаётся dumb/presentational (без сервисов), visual state полностью определяется `@Input`.

Apple-style правила карточки:
- без внутренних горизонтальных разделителей и лишних бордеров;
- `title` доминирует (`14px`, `700`), `sku` вторичен (`11px`, muted);
- если описание пустое, блок description не рендерится;
- кнопка `Добавить` использует `ui-btn` (`variant="secondary"`, `size="sm"`) вместо локального кастомного button-стиля;
- цена в карточке (`.price-tag .value`) визуально вторична и использует `--ui-text-muted`;
- если у товара есть `specId`, в углу показывается компактный badge-индикатор техпаспорта;
- тень карточки мягкая в baseline (`--shadow-sm`) и немного усиливается на hover.

---

## KP Builder Right Panel (`Состав КП`)

UI-правила плотного списка:
- элементы рендерятся как компактные SaaS-строки `selected-row` без карточных подложек (тонкий `border-bottom`, 40x40 thumb, name/meta, компактный stepper, итог справа);
- layout строки построен на `display:flex` (не grid), чтобы на узкой панели элементы сжимались предсказуемо и не наезжали друг на друга;
- для текстового блока обязательно `item-info { flex:1; min-width:0; }` + `line-clamp/ellipsis`, чтобы длинные названия не выталкивали controls;
- в строке есть рабочий `drag-handle` на `@angular/cdk/drag-drop` (`cdkDragHandle`), по умолчанию бледный и заметнее при hover/focus;
- правый блок действий фиксирован (`item-actions`/`item-remove-slot` не сжимаются), а `total-price` держит `min-width` и `tabular-nums` для ровной колонки сумм;
- drag UX: placeholder рендерится пунктиром, а dragged-preview получает мягкую тень/поднятие;
- удаление позиции выполняется через `remove-btn`, который появляется через `opacity` на hover/focus (без layout shift);
- stepper реализуется как единый compact-control: ширина `~76px`, высота `24px`, лёгкий token-driven фон + тонкие внутренние разделители между `- / qty / +`, `border-radius:4px`;
- для защиты от конфликтов с глобальными кнопочными стилями `[ui-btn].btn--icon` внутри stepper используется более специфичный локальный селектор (`.stepper .stepper__btn[ui-btn].btn--icon`);
- в правой панели `Состав КП` денежные значения (`База`, line total) отображаются в формате `47,500 ₽` (символ рубля после числа) для консистентности с документной таблицей.
- блок пересчёта (`Наценка/Скидка` + итог) расположен в sticky-footer внизу правой колонки;
- list area скроллится отдельно от sticky-footer (footer всегда остаётся в зоне видимости).

Pagination preview invariants (`kp-document`):
- разбиение таблицы в preview/PDF выполняется строго по лимитам из metadata: `tablePageBreakFirstPage` для первой страницы и `tablePageBreakNextPages` для 2+ страниц;
- алгоритм детерминированный `slice` (без авто-балансировки высоты/«перетекания» строк);
- fallback при отсутствии лимитов: `5` (первая) и `10` (следующие);
- текст `Продолжение таблицы — на стр. N` выводится на каждой странице, кроме последней; summary/footer рендерится только на последней странице.
- подпись `Продолжение таблицы` должна идти сразу под таблицей (малый верхний отступ), а не «прилипать» к низу листа.
- для защиты подвала от наезда на нижний фон используется safe-zone в `.kp-content` (`--kp-bottom-safe-zone`, default `40mm`); summary-блок на последней странице идёт вплотную к таблице (`margin-top: 6px`) без «улёта» к декоративному подвалу.
- Для максимально плотной геометрии таблицы в документе верхний отступ continuation-страниц равен `0` (таблица начинается максимально близко к верхнему краю контентной области).
- у `.kp-sheet__content` обязательно `box-sizing: border-box` + `height: 100%`, чтобы внутренние отступы не раздували физическую высоту A4-листа.

Dark-mode нюансы:
- для разделителей строк использовать `--ui-border-subtle`, для hover — `--ui-bg-hover`, чтобы не было «неонового» контраста на тёмном фоне;
- stepper и узкие input-контролы должны опираться на `--ui-bg-card`/`--ui-border` + token-driven `color-mix` (без hardcoded `#fff/#000`), сохраняя компактную геометрию и `tabular-nums` в `qty-input`;
- итог позиции в строке может быть акцентирован через `--kp-line-total-color` (по умолчанию в dark — мягкий success-акцент).

---

## ProductSpecViewerComponent

**Селектор:** `<app-product-spec-viewer>`

Назначение: dumb-компонент для рендера групп технических характеристик товара в паспортном табличном виде.

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `groups` | `ProductSpecGroup[]` | `[]` | Разделы и параметры техпаспорта |

UI-правила:
- левая колонка: наименование показателя;
- правая колонка: значение;
- секции визуально отделяются мягким серым заголовком (Apple-style, без тяжёлых рамок).

## ProductSpecEditorComponent

**Селектор:** `<app-product-spec-editor>`

Назначение: inspector-редактор техпрофиля товара внутри правого drawer (чертежи + динамические группы параметров) с встроенным preview через `app-product-spec-viewer`.

Ключевые UX-правила:
- загрузка чертежей через file-input (`POST /api/product-specs/upload`);
- блок чертежей работает в формате `thumbnail + upload + очистка` (без ручного редактирования URL);
- upload-контрол в блоке чертежей оформлен через `ui-btn` + hidden file input (вместо нативного file-поля в потоке формы);
- добавление/удаление групп и строк параметров в runtime;
- блок «Копирование из аналога» выполнен как accordion для уменьшения визуального шума; внутри — поиск товара-донора и перенос характеристик;
- опция `Копировать также чертежи` для контроля наследования media-блока;
- action-полка вверху inspector: `Заполнить по шаблону`, `Посмотреть паспорт`, `Скачать PDF`, `Сохранить`;
- шаблоны загружаются с backend (`GET /api/product-specs/templates`) и применяются в один клик.

## DrawerComponent
Visual rules:
- `ui-modal` и `ui-drawer` используют blur-backdrop (`backdrop-filter: blur(4px)`) + полупрозрачный затемняющий слой;
- контейнеры опираются на `var(--ui-bg-card)` и глубокую тень уровня `0 20px 40px ...`;
- enter-анимации: modal (`fade + scale-in`), drawer (`fade + slide-in`);
- close-кнопка в header: только `ui-btn variant="ghost" icon`.

---


**Селектор:** `<ui-drawer>`

Назначение: правый inspector-контейнер для сложных CRUD-редакторов без nested modal overlay.

| Input | Default | Output |
|-------|---------|--------|
| `title: string` | `''` | `closed` |
| `width: string` | `'min(980px, 92vw)'` | |
| `closeOnBackdrop: boolean` | `true` | |

Слоты: `drawer-body`, `drawer-footer`.

---

## NotificationService + ToastComponent

**Сервис:** `frontend/src/app/core/services/notification.service.ts`  
**Компонент:** `frontend/src/app/core/components/toast/toast.component.ts`  
`ToastComponent` подключён в `AppShellComponent` — работает глобально.

```typescript
// Инжектировать в любой компонент:
private ns = inject(NotificationService);

this.ns.success('Товар сохранён');
this.ns.error('Ошибка при удалении');
this.ns.warning('Несохранённые изменения');
this.ns.info('Загрузка...');

// Или с кастомной длительностью (мс):
this.ns.show('Сообщение', 'success', 3000);
```

Toast автоматически исчезает (default: 4 сек, error: 6 сек).  
Клик по toast — немедленное закрытие.

Надёжность сообщений:
- `NotificationService` нормализует входящее сообщение (`string | object`) и извлекает `message` / `error.message`, иначе показывает fallback `Произошла ошибка. Попробуйте еще раз`;
- пустые toasts не добавляются в стек;
- в `ToastComponent` есть fallback-текст и явная кнопка закрытия (`×`) без побочных кликов по контейнеру.
- добавлена дедупликация anti-spam: одинаковый toast (`type + message`) в окне ~2.5с не дублируется, а продлевает время жизни уже показанного уведомления.

---

## Design Tokens

Файл: `frontend/src/styles/_tokens.scss`

```scss
@use '../../../../styles/tokens' as *;
.element { color: $color-primary; padding: $space-4; }
```

| Группа | Ключевые токены |
|--------|----------------|
| Apple semantic tokens | `--ui-font-family`, `--ui-primary` (`#007aff`), `--ui-primary-hover` (`#0062cc`), `--ui-bg-main` (`#f2f2f7`), `--ui-bg-card`, `--ui-bg-hover`, `--ui-text-main`, `--ui-text-muted`, `--ui-focus-ring-shadow` |
| Цвета | `$color-primary`, `$color-danger`, `$color-success` (через theme variables) |
| Текст | `$color-text`, `$color-text-muted`, `$color-text-light` |
| Фон/Границы | `$color-bg`, `$color-bg-soft`, `$color-bg-muted`, `$color-border` |
| Отступы | `$space-1..8` (0.25rem..2rem) |
| Типографика | `$font-xs..3xl` (0.75rem..1.75rem) |
| Радиусы | `$radius-sm..2xl` (4px..12px) |
| Тени | `$shadow-sm..xl` |
| Z-index | `$z-modal` (1000), `$z-dialog` (1100), `$z-tooltip` (1200) |

---

## Form And Button Density

Новые базовые файлы:
- `frontend/src/styles/_forms.scss`
- `frontend/src/styles/_buttons.scss`

Базовые переменные:
- `--ui-control-height` (`36px`), `--ui-control-height-sm` (`32px`)
- `--ui-btn-height` (`32px`), `--ui-btn-height-lg` (`36px`)
- `--ui-font-size-md` (`14px`)

Базовые utility-классы:
- `.form-control` — единая высота/padding/focus для `input/select/textarea`;
- `.form-control--sm` — компактный вариант;
- `.form-group` — вертикальный ритм формы (`margin-bottom: var(--ui-spacing-4)`).

Правило: для новых форм использовать `.form-control` и не задавать локальные высоты через произвольные px.

---

## Глобальные CSS-классы (`styles/_global.scss`)

| Класс | Описание |
|-------|----------|
| `.page` | max-width 1400px, padding 2rem |
| `.page-header` | flex: заголовок + действия |
| `.page-toolbar` | flex: поиск + фильтры |
| `.search-input` | системный style для поля поиска (token-driven, focus ring, адаптивная ширина через CSS var) |
| `.filter-select` | системный style для select-фильтров (token-driven, min-width через CSS var) |
| `.data-table` | базовый стиль таблиц (header/body/hover/border/radius/shadow) для всех экранов |
| `.table-scroll` | универсальная обёртка с `overflow-x: auto` для широких таблиц |
| `.ui-table-actions` | единый стиль action-кнопок в таблицах (secondary/danger + spacing) |
| `.empty-state` | Центрированный пустой блок |
| `.loading-state` | Спиннер + текст |
| `.no-print` | Скрыть при `@media print` |

Глобальные semantic UI-переменные:
- `--ui-success`, `--ui-warning`, `--ui-danger` — единый слой статусов и ошибок в light/dark.

---

## KP Builder Layout (responsive)

Файлы: `features/kp/kp-builder/kp-builder.layout.scss`, `kp-builder.sidebar.scss`, `kp-builder.widgets.scss`

- Рабочая область строится как единая 3-колоночная grid-сетка: `лево / превью / право`.
- На узких ширинах колонки не “падают” друг под друга хаотично: контейнер использует общий scroll и сохраняет связку колонок.
- Ширины колонок задаются через CSS-переменные (`--kp-left-col`, `--kp-right-col`, `--kp-preview-min`) и адаптируются брейкпоинтами.
- Тулбар фиксирован по высоте; на мобильных ширинах допускается перенос кнопок в несколько строк.
- Для блока `Состав КП` используется массовая панель корректировок (`Наценка/Скидка`) + выбор строк, вместо дублирования однотипных полей в каждой карточке.
- В desktop-режиме колонка каталога расширена, а сетка карточек каталога может отображаться в 2 колонки; на узких ширинах автоматически возвращается в 1 колонку.
- Layout-shell построен по slot-паттерну (`left / center / right`) через grid-areas; контентные панели используют `min-width: 0`.
- На tablet (`<=960`) правая панель переходит во вторую строку (`right right`) вместо хаотичного “провала”.
- На mobile (`<=760`) порядок зон: `center -> left -> right` в одну колонку без transform-scale.

### Global Layout Rules

- Layout model единый для экранов внутри shell:
  - sidebar (`AppShell`) = contextual navigation,
  - page container (`.page`) = content zone,
  - hero/canvas zones = bounded by `--layout-hero-max`.
- Глобальные layout tokens (`styles/_global.scss`):
  - `--layout-shell-sidebar`
  - `--layout-page-max`
  - `--layout-page-padding`
  - `--layout-content-gap`
  - `--layout-hero-max`
- Breakpoints консистентны по системе:
  - `1920/1440` desktop scales,
  - `1024` tablet transition,
  - `768` mobile layout switch,
  - `390` compact spacing.
- Запрещено переопределять `.page` и `.page-header` локально в feature SCSS без system-level причины.
- Для поисковых панелей и таблиц использовать только системные классы `.search-input`, `.filter-select`, `.data-table` (локально разрешены только переменные размеров/плотности).
- Экран `Dictionaries` использует `page-toolbar + filter-select` (без локального toolbar-паттерна), а `Settings/Backups` использует те же `search-input/filter-select` для полного совпадения поведения focus/hover/size между экранами.
- Freeze-stabilization edge cases: на `<=768` фильтры/toolbar в `Settings/Backups` и форма в `Dictionaries` обязаны перестраиваться без horizontal overflow (одноколоночный fallback, wrap действий).

### Visual Premium Polish (no structural changes)

- Типографическая иерархия усилена на уровне global styles: `page-header h1` получил более выраженный display-контраст (вес/letter-spacing), meta-тексты остаются приглушёнными.
- Повышена “воздушность” и ритм: увеличены вертикальные паузы между `page-header` и `page-toolbar`, а также уплотнена читаемость пустых состояний.
- Surface-depth усилен без новых токенов: таблицы и sidebar получили более мягкое разделение слоёв через `color-mix` и аккуратные тени (без бордер-шума).
- Вес действий перераспределён: `primary` кнопки получили более уверенный визуальный приоритет, `ghost` и secondary остались тише, destructive оформлены semantic `--ui-danger` без агрессии.

### Users screen alignment

- Экран `/users` приведён к общей композиции shell: `page-header` + card-sections (`create/list`) + `data-table`.
- Для полей и select используется единая token-driven форма (`users-field`) с таким же focus-ring и плотностью, как у системных controls.
- В таблице пользователей добавлены статусные pill-label (`active/inactive`) и компактный блок reset-password без визуального шума.
- На tablet/mobile форма создания пользователя перестраивается из 5-колоночной сетки в 2/1 колонку без переполнений.

### Micro-detail tuning (Apple-level craft pass)

- Micro-typography: заголовки и labels выровнены по optical rhythm (`line-height`, `letter-spacing`, `font-weight`) для более чистой иерархии без перегруза.
- Optical spacing: выровнены вертикальные паузы `header -> toolbar -> content` и baseline-контроль в mixed-группах (`input/select/button`).
- Pixel alignment: у toolbar-контролов и переключателей видов (`view-toggle`) выровнен vertical center и одинаковая perceptual height.
- Interaction softness: hover/focus/active состояния стали более “тихими” (минимальные, но читаемые смещения/ореолы), без агрессивного контраста.

### Visual friction cleanup (autopilot pass)

- Устранены competing accents на data-экранах: actions в таблицах `Products/Counterparties/Dictionaries` визуально понижены до вторичного веса, destructive-кнопки стали semantic и менее агрессивными.
- `Home` карточки КП сбалансированы по акцентам (total не конкурирует с badge/actions).
- `Settings` и `KP Builder` top-zones приглушены: secondary controls и status-блоки не перетягивают внимание с контента.
- Для `KP Builder` правой панели уменьшен цветовой шум секций/bulk-блока, чтобы документ в центре оставался главным визуальным фокусом.

### KP Builder composition layer (document-first)

- Центр `KP Builder` переведён в “document composition” режим без изменения архитектуры: документ получил явный frame (мягкая граница/глубина) вместо ощущения пустого canvas.
- Внутри КП добавлены визуальные зоны через существующую разметку:
  - `header block`,
  - `main content block` (товарная таблица),
  - `summary block` (итоги/условия, правый весовой якорь).
- Для таблицы и итогов выполнен density control:
  - чуть tighter row spacing,
  - компактнее типографика описаний/итогов,
  - усилена иерархия summary блока как финальной точки внимания.
- Финальный polish центрального документа: увеличены вертикальные интервалы между `header -> table -> summary -> footer`, чтобы блоки не слипались и легче сканировались.
- Для таблицы товаров КП на screen-режиме увеличен комфортный `cell padding`; в print-режиме сохранён более плотный ритм, чтобы не ломать пагинацию PDF.
- На tablet/mobile `kp-document` использует responsive-fit `kp-sheet` (без горизонтального скролла), при этом в `@media print` принудительно возвращается физическая геометрия A4 (`210x296mm`) для стабильного Puppeteer.
- Левый/правый sidebar в `KP Builder` получили немного более выраженный surface contrast, чтобы композиционно “держать” центр.
- По запросу production-печати/визуала: боковые кромки контента КП уменьшены до `5mm` (`kp-sheet__content` horizontal padding), а фоновые заливки внутренних блоков документа (`main/summary/meta/table header`) переведены в прозрачные.

### Toolbar & Top Actions

- Toolbar разбит на две логические группы:
  - `builder__toolbar-main` (назад, title, статус КП),
  - `builder__toolbar-actions` (status badge, secondary actions, primary save).
- Primary action: `Сохранить`.
- Secondary actions: `PDF / Печать` (для `KP Builder` кнопка `Скачать PDF` должна быть quiet-уровня `secondary`/`ghost`, не primary).
- Status badge (`save-status`) оформлен как компактный системный индикатор и не ломает компоновку.
- Responsive:
  - desktop: один горизонтальный ряд;
  - tablet: перенос в аккуратные 2 строки (main/actions);
  - mobile: компактный двухуровневый toolbar с уменьшенной высотой контролов.

### KP Builder UX controls

- В `Состав КП` добавлены быстрые массовые действия:
  - `Выбрать все`,
  - `Снять выделение`,
  - `Сбросить наценку/скидку`.
- Поля `Наценка (%)` и `Скидка (%)` работают в real-time: ввод процента сразу применяет значение ко всем выбранным позициям (без отдельной кнопки применения).
- В `Состав КП` каждая строка имеет checkbox-метку участия в bulk-корректировках; `Наценка/Скидка` применяются только к отмеченным позициям, по умолчанию чекбоксы включены у всех товаров.
- В `KP Builder` bulk-поля `Наценка (%)` и `Скидка (%)` в sticky-footer правой панели выравниваются в одну строку (две равные колонки), чтобы экономить вертикальное пространство.
- Интерактивность выбора: если после применения наценки/скидки снять галочку у позиции, для этой позиции корректировки сбрасываются (`markup/discount = 0`), и цена строки сразу возвращается к базовой.
- Для каждой позиции показывается формула цены (`База → +%/-% → итог`) для прозрачности расчёта.
- Empty state панели состава сохранён и стилизован в общем системном ключе.
- В `KP Builder` для кнопки `+ Добавить товар` используется compact-модалка `product-form` (табличный ввод): `Артикул/Наименование/Описание/Ед./Цена` в одну строку, без перегруженных полей карточки товара.
- Блок `Параметры КП` в правой панели использует плотную 2-колоночную сетку на desktop: поля рендерятся попарно в равных колонках для экономии высоты.
- В `Параметры КП` все form-controls (`input/select`, template `+` action, checkbox-блок) используют единую геометрию поля (`~2.25rem`, общий border/radius/focus-ring), чтобы убрать визуальный разнобой между строками.
- В `Параметры КП` поля `input/select/number` должны использовать `form-control` (или эквивалентный token-driven стиль) для единой высоты, радиуса и `--ui-focus-ring-shadow`.
- В `Параметры КП` `Размер фото (%)` использует кастомный `input[type="range"]`: тонкий subdued-track (`--ui-border-subtle`) и компактный круглый thumb без нативного browser-стиля.
- Кликабельные заголовки секций в правой панели `KP Builder` (`Параметры КП`, `Состав КП`, `Условия`) читаются за счёт более тёмного текста/шеврона и веса заголовка; фоновый hover-rectangle для заголовка не используется.
- Секции правой панели `KP Builder` строятся по typography-first принципу: без тяжёлых фоновых плашек/бордер-блоков, акцент через заголовок и межсекционный вертикальный интервал.
- На `<=1024px` сетка `Параметры КП` автоматически возвращается в 1 колонку.
- Добавлен параметр `Размер фото (%)` в `Параметры КП` (диапазон `150..350`) с визуальным range-slider + числовым полем.
- В `Параметры КП` видимость колонки `Фото` переключается компактной toggle-кнопкой с иконкой глаза; активное/неактивное состояние читается по цвету и подписи.
- Подписи полей переноса строк в `Параметры КП` используются в компактном формате: `Перенос строк (1-я стр.)` и `Перенос (след. стр.)`.
- В `Параметры КП` type-controls работают в instant-режиме: при выборе `Тип документа` или `Шаблон брендирования` переключение отправляется сразу, без отдельной кнопки и без confirm-диалога.
- В `Параметры КП` добавлен селект `Наша компания`; смена компании работает тем же instant-flow (через `switch-type` API с `companyId`) и пересобирает branding snapshot документа.
- В `Параметры КП` у поля `Шаблон брендирования` action перенесён в компактную `+`-кнопку справа (UI-kit style); deep-link переход в `Counterparties` открывает менеджер бренд-шаблонов сразу на выбранной компании.
- Селект `Шаблон брендирования` показывается только когда для выбранного типа доступно больше одного шаблона; при единственном шаблоне интерфейс остаётся в auto-режиме без лишнего выбора.
- Выполнен density-pass кнопок в боковых панелях `KP Builder`: для `ui-btn` унифицированы высота/радиус, а `icon`-кнопки (qty/условия) получили явную рамку и фон, чтобы визуально не выпадать из UI-kit.
- Stepper количества в строках `Состав КП` использует увеличенную touch-friendly геометрию (`32px` высота, `96px` ширина, `8px` radius, центрированное numeric-поле), чтобы контрол выглядел аккуратнее и легче читался.
- Для stepper количества применён типографический polish: фиксированная 3-колоночная сетка (`- / value / +`), более ровная геометрия центральной numeric-ячейки и табличные цифры (`tnum/lnum`) для чистого визуального центра значения.
- Row-checkbox в `Состав КП` не использует нативный browser accent: custom `appearance:none` with token border и `checked` state через `--ui-primary`.
- Stepper в `Состав КП` визуально должен быть единым pill-контролом: мягкий hover у `+/-`, без тяжёлых внутренних рамок и без нативных spinner-стрелок у числового input.
- Символы `+/-` в stepper центрируются по высоте через стандартный baseline (`line-height: 1`) и нулевые вертикальные padding у кнопок, чтобы исключить визуальный сдвиг вверх/вниз.
- Для стабильного визуального центра stepper использует отдельные glyph-элементы (`stepper__glyph`) с одинаковой микро-коррекцией по оси Y; это убирает “плавание” `+/-` между состояниями и шрифтами.
- В `kp-params-grid` зафиксированы общие переменные геометрии контролов (`--kp-control-height`, `--kp-control-radius`), которые применяются ко всем полям (`input/select`, template `+`, photo-toggle) для единого ритма.
- Bulk-поля `Наценка (%)`/`Скидка (%)` инициализируются из `metadata.defaultMarkupPercent/defaultDiscountPercent` (значения компании-инициатора) и остаются редактируемыми в реальном времени.
- Масштаб применяется пропорционально: фото в таблице КП получают одинаковые `width/height` по значению параметра, поэтому изменение размера всегда предсказуемо визуально.
- Для премиального вида таблицы КП ослаблена “решётка”: базовые вертикальные границы сделаны заметно мягче, а акцент оставлен только на ключевых числовых колонках (`qty/unit/price/sum`).
- Для исключения двусмысленности по НДС таблица КП использует явные подписи `Цена (вкл. НДС)` и `Сумма (вкл. НДС)`, а НДС показывается отдельной колонкой `НДС (в т.ч.)`.
 - Для уменьшения серых зон вокруг документа центр фиксируется по `--kp-center-col`, а свободная ширина перераспределяется в левую/правую панели (`minmax(..., 1fr)`), без изменения масштаба/высоты документа.
 - В `KP Builder` задан таргетированный боковой зазор предпросмотра `--kp-center-side-gap: 5mm`: это оставляет тонкую «рамку» серого фона (около 5 мм слева/справа) без изменения масштаба и высоты документа.
 - Для точной геометрии зазора отключена адаптивная ширина `min(100%, ...)` у `builder__preview-scale`: ширина документа фиксируется как `--layout-hero-max`, а уменьшение выполняется только через `transform: scale(...)`.
 - Зазор в `KP Builder` дополнительно сужен до `3mm` (`--kp-center-side-gap`) по обратной связи, чтобы серый фон по бокам был почти незаметен.
 - По итогам визуальной проверки зазор в `KP Builder` дополнительно сужен до `2mm` (`--kp-center-side-gap`) без изменения масштаба/высоты документа.
 - Для финального экранного выравнивания зазор предпросмотра сужен до `1mm`, а фон центральной зоны синхронизирован с `--ui-bg`, чтобы убрать остаточный серый ореол без изменения размеров документа.
 - В `KP Builder` убран избыточный общий скролл рабочей области: базовый контейнер теперь `overflow: hidden`, а прокрутка оставлена только в боковых панелях (`overflow-y: auto`), где она действительно нужна.
- В блоке `Получатель` (KP Builder) оставлен только рабочий контрол выбора получателя из справочника (и `+` создание), без служебного snapshot-note текста, чтобы убрать лишний визуальный шум.
- На главной `Коммерческие предложения` карточки списка заменены на табличный вид (№, статус, название, получатель, сумма, дата, действия), чтобы удобнее работать с сохранёнными КП и быстрее сравнивать записи.
- В таблице `Пользователи` устранено дублирование роли: убран дополнительный role-badge, оставлен единый контрол выбора роли (`select`) для более чистого ряда.
- Матрица RBAC вынесена в отдельный экран `Роли и полномочия` (`/roles-permissions`) в формате 40/60: слева таблица ролей, справа панель прав выбранной роли.
- В таблице ролей поддержаны: инлайн-rename (иконка карандаша), признак `Системная/Кастомная`, действия `Копировать` и `Удалить` (только для кастомных ролей).
- Панель прав использует группировку по модулям и чекбоксы; для `owner/admin` редактирование заблокировано с явным пояснением.
- Глобальные действия на экране: `+ Создать роль` (модалка), `Сохранить изменения` (только dirty-изменения), `Отменить` (rollback к последнему сохранённому состоянию).
- Таблица `Counterparties` (`counterparty-table`): три колонки — «Короткое название» (`shortName`, fallback `name`), «ИНН», действия; `table-layout: fixed` + `colgroup` с фиксированными ширинами (`col-name: 170px`, `col-inn: 140px`, `col-actions: 140px`). Action-кнопки рендерятся компактными icon-only (`Шаблоны/Изменить/Удалить`) с `title`/`aria-label`.
- В колонке `Наша компания` у строки доступно действие `Шаблоны`, которое открывает отдельный менеджер бренд-шаблонов (assets/default/conditions) без перегрузки формы контрагента.
- Менеджер шаблонов брендирования рендерится как accordion по карточкам шаблонов (заголовок с toggle `▸/▾`), чтобы форма не превращалась в длинный непрерывный список полей.
- Для карточки шаблона `Ответ на письмо` UI упрощается: в `Assets` остаётся только блок `Фон — страница 1`; блоки `страница 2+ / паспорт / appendix` не показываются.
- `counterparty-form` теперь отвечает только за базовые данные контрагента; блок редактирования `brandingTemplates` убран из этой формы.
- Для роли `Наша компания` в `counterparty-form` добавлены поля `% наценки/% скидки по умолчанию`, которые используются как defaults в `KP Builder`.
- Экран `/counterparties` использует трёхколоночный layout по ролям слева направо: `Клиент` → `Поставщик` → `Наша компания`; каждая колонка рендерит свой `counterparty-table`, spacing между колонками увеличен.
- В `KP Document` summary-зона (`Итоги + Условия`) теперь равна ширине товарной таблицы: totals остаются в правом сегменте (прежняя визуальная привязка), условия печатаются отдельным блоком слева на полной ширине.
- В форме контрагента (`Шаблоны брендирования КП`) блок `Texts` заменён на `Условия`: компактный editable-список пунктов (`+`, input, удаление `✕`) для точной настройки финального списка условий в КП.
- Для печати КП устранён ложный второй пустой лист: контейнер страницы `kp-sheet` в print-режиме рендерится без рамки/тени и с корректным `box-sizing: border-box`, чтобы не выходить за физический размер A4.
- На главной в селекте шаблонов КП дефолтный шаблон визуально помечается `✓`, а в форме `Шаблоны брендирования КП` первый шаблон каждого `kpType` автоматически получает флаг `По умолчанию`.
- В форме контрагента (для роли `Наша компания`) добавлен чекбокс `Компания по умолчанию для создания КП`; Home использует этот признак как backend default при `+ Создать КП` (без явных селектов компании/типа/шаблона на главной).
- В `KP Builder` центральная зона preview поддерживает вертикальный скролл, чтобы при многостраничном КП (много товаров) страницы 2+ были видны в интерфейсе, а не обрезались высотой viewport.
- В print-режиме `KP Builder` принудительно отключает preview-scroll контейнеры и screen-transform, чтобы в печати/preview не появлялись внутренние скроллбары поверх страницы документа.
- В screen-режиме `KP Builder` скролл в центральном preview активируется только для многостраничных КП (когда есть страница 2+), чтобы одностраничный режим оставался чистым.
- В `KP Builder` документная таблица слева работает как preview-only по ценам (`editablePrices=false`): редактирование цен выполняется через правую панель `Состав КП` (bulk-наценка/скидка и пересчёт итогов).
- В `KpTable` блок итогов (`Итого`, `В том числе НДС`, `Всего к оплате`) использует предельно плотный вертикальный ритм: минимальные межстрочные/межблочные отступы и плотный `line-height`.
- В backend PDF-шаблоне (`kp-pdf.service`) для блока итогов (`Итого`, `В том числе НДС`, `Всего к оплате`) зафиксирован `line-height: 17px` для более свободного межстрочного ритма при печати/экспорте.
- В backend PDF-шаблоне (`kp-pdf.service`) у VAT-строки итогов (`В том числе НДС`) отключена нижняя разделительная линия (`border-bottom`), чтобы строка отображалась без подчёркивания.
- Для шаблонных текстов `KP Builder/KP Document` используется единый pipeline `KpTemplateService` + pipe `kpTemplate` (standalone): поддержаны токены Mustache (`{{client_name}}`, `{{kp_number}}`, `{{total_amount}}`, `{{date}}`, `{{manager_name}}`), неизвестные токены не удаляются.
- В секции `Условия` правой панели обязателен helper-блок «Доступные переменные» (компактный и low-noise), чтобы менеджер видел допустимые токены без перехода в документацию.
- Storybook используется как UI governance слой: `button`, `form-field`, `status-badge`, `kp-catalog-item` покрыты историями и должны рендериться на том же token/theme-слое, что и runtime.
- В toolbar `KP Builder` поддерживается hybrid PDF UX: отдельные actions `Печать (быстро)` и `Скачать PDF (HQ)`; для HQ-кнопки обязателен локальный loading-state и явные success/error уведомления.
- Для уменьшения визуального шума hybrid PDF UX рендерится как split-button: primary action `Скачать PDF`, а `Быстрая печать (Draft)` живёт в dropdown-меню стрелки (hover/focus-within).
- Dropdown PDF-меню в `KP Builder` управляется сигналом (`isPdfMenuOpen`) и `@if`-рендером: открытие по click на стрелку, закрытие по click outside, без hover-only логики.
- Все интерактивные поля в целевых стилях `kp-builder` используют `:focus-visible` (вместо `:focus`) и единый ring через `--ui-focus-ring`.
- Для `shared/ui` введён единый focus-mechanism на уровне токенов: `--ui-focus-ring-shadow`; `button/search-input/filter-select/form-field` используют этот слой вместо локальных вариаций box-shadow.
- Focus ring усилен для клавиатурной навигации (Apple-style доступность): `--ui-focus-ring-shadow` использует более контрастный mix от `--ui-focus-ring`, чтобы контур уверенно читался в Storybook и в runtime.
- Маркер обязательности унифицирован через глобальный utility-класс `.ui-required` (`styles/_global.scss`), локальные дубли `.required` в формовых/feature-стилях убраны.
- В продуктовых SCSS для builder-а запрещён micro-font ниже `0.75rem`; значения `9px/10px` удалены.

### KP Builder center fit

- Центр предпросмотра (`builder__preview`) работает без внутренних отступов.
- Высота документа стабилизируется через `--kp-preview-scale` и `transform: scale(...)` в `builder__preview-scale`.
- Точка привязки масштаба — `top center`, чтобы документ не «прыгал» по вертикали при изменении высоты viewport.

### KP Builder loading skeleton

- Для состояния загрузки используется не текстовый placeholder, а структурный skeleton:
  - `toolbar skeleton`,
  - `left sidebar skeleton`,
  - `document preview skeleton`,
  - `right sidebar skeleton`.
- Для shimmer-эффекта используется единый класс `.skeleton-loader` + keyframes `builder-shimmer`.
- Skeleton должен повторять геометрию финального layout, чтобы снизить perceived latency и убрать эффект «белого экрана».

## Theme System (light/dark)

- Глобальная тема управляется сервисом `core/services/theme.service.ts`.
- Активная тема выставляется атрибутом `data-theme` на корневом элементе документа и дублируется классом `.dark-theme` на `body` (совместимость со style-layer, завязанным на class selector).
- Базовые CSS-переменные темы определены в `styles/_global.scss`:
  - `--ui-bg`, `--ui-bg-soft`, `--ui-bg-muted`
  - `--ui-text`, `--ui-text-muted`
  - `--ui-border`, `--ui-border-light`
  - `--ui-primary`
- Переключение темы доступно из `AppShell` как compact icon-toggle (`ui-btn` `variant="ghost"` + sun/moon glyph), выбор сохраняется в `localStorage` (`kppdf-theme`).
- Для micro-interaction toggler рендерит обе иконки одновременно (sun + moon в DOM) и переключает состояния через `opacity + transform (rotate/scale)` — это убирает рывки `@if`-перерисовки и даёт smooth crossfade.
- Для новых UI-экранов: фон/текст/границы использовать через `var(--ui-*)`, не хардкодить светлые цвета.
- Для документных блоков КП (`kp-header`, `kp-table`, `kp-document`, `kp-catalog`) также использовать `--ui-*` + `color-mix`, чтобы light/dark и будущая ребрендинг-палитра применялись без локальных hex/rgba правок.
- Таблица товаров в `kp-catalog` использует minimalist invoice-style:
  - без внешней рамки и без вертикальных разделителей колонок;
  - только горизонтальные row-dividers (`border-bottom: 0.5pt #e5e7eb`);
  - header в subdued-режиме (`#f9fafb`, uppercase, muted text, letter-spacing).
- Миниатюры фото в строках таблицы ограничены `min/max` размером (clamp в `kp-catalog.component.ts`), чтобы `photoScalePercent` не раздувал высоту строки; пропорции сохраняются через `object-fit: contain`.
- Если `imageUrl` отсутствует или изображение не загрузилось (`img error`), ячейка `Фото` остаётся пустой: не рендерятся broken-icon и fallback-текст.
- Для `photoScalePercent` используется диапазон `350..700` (builder slider + number input + backend validation синхронизированы); в `kp-catalog` масштаб фото нормализуется относительно этого диапазона без растягивания.
- Выравнивание таблицы: все колонки центрируются, кроме `Наименование` (оно остаётся left-aligned для читаемости длинного текста).
- Заголовки (`th`) во всех колонках центрируются единообразно; для `Наименование/Описание` left-выравнивание сохраняется только у содержимого ячеек (`td`), не у header.
- Выравнивание содержимого (`td`) в таблице КП: центр для всех колонок, исключения — только `Наименование` и `Описание` (left-aligned).
- В режиме inline-редактирования `Цена` input также центрируется, чтобы не выбиваться из общей геометрии колонок.
- В ценовых колонках `Цена` и `Сумма` валюта выводится постфиксом с небольшим зазором (`число ₽`) для читаемости и единообразия.
- В режиме inline-редактирования `Цена` используется тот же паттерн: фиксированная компактная ширина input + суффикс `₽` с малым отступом.
- Для inline-input цены отключаются нативные number-steppers (стрелки ↑/↓), чтобы не ломать плотность колонки и не добавлять лишний правый отступ.
- Для inline редактирования цены использовать ghost-input паттерн: по умолчанию text-like (прозрачный фон/без видимой рамки), визуальный affordance появляется только на `:hover` и `:focus-visible`.
- Для типографики документных блоков КП использовать split-подход: экранные размеры в `rem` (через css custom properties), печатные в `pt` внутри `@media print`, чтобы не разъезжались web-preview и PDF.
- В `kp-header` мета-блок справа (`№/Дата/Действует/...`) держать в тонком контуре: облегчённая граница, компактный радиус и плотные внутренние отступы, чтобы блок не выглядел тяжёлой рамкой.
- Для ultra-compact режима допускается максимально плотная посадка рамки к тексту в `kp-meta`: минимальные внутренние отступы и почти нулевые межстрочные интервалы (без потери читабельности меток/значений).
- Для уменьшения пустого зазора перед таблицей у `kp-header` используется минимальный `margin-bottom` (практически вплотную к заголовку таблицы).
- Вертикальный отступ до блока получателя в `kp-header` (`margin-top`) можно регулировать для точной посадки под фирменный заголовок; актуально уменьшен в 2 раза для более плотного первого экрана.
- Ключевые feature-экраны переведены на `--ui-*`: `Home`, `Products` (controls/table/card/form), `Counterparties` (filters/table), `Settings`, `Dictionaries`, `Login`, а также `KP Builder`.
- Добавлены системные переменные для финального полиша:
  - `--ui-canvas` (фон viewer/рабочих холстов),
  - `--ui-success`,
  - `--ui-code-bg`, `--ui-code-fg`.
- Глобальные `input/select/textarea` получили единые `focus`/`disabled` состояния (theme-aware).
- `ui-btn` получил унифицированный `focus-visible` ring и консистентное поведение в light/dark.

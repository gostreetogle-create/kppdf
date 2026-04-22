# UI Kit

Все компоненты в `frontend/src/app/shared/ui/`.  
Импорт: `import { ButtonComponent, ... } from '../../shared/ui/index'`.

---

## ButtonComponent

**Селектор:** `button[ui-btn]`, `a[ui-btn]`

| Input | Тип | Default | Описание |
|-------|-----|---------|----------|
| `variant` | `default\|primary\|danger\|ghost` | `default` | Стиль |
| `size` | `sm\|md\|lg` | `md` | Размер |
| `icon` | boolean | `false` | Квадратная иконка-кнопка |

```html
<button ui-btn variant="primary">Сохранить</button>
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
Стилизует вложенные `input`, `textarea`, `select` через `::ng-deep`.

| Input | Default | Описание |
|-------|---------|----------|
| `label: string` | `''` | Метка |
| `required: boolean` | `false` | Красная звёздочка |
| `error: string` | `''` | Ошибка под полем |
| `hint: string` | `''` | Подсказка под полем |

```html
<ui-form-field label="Название" [required]="true" [error]="errors.name">
  <input type="text" [(ngModel)]="form.name" />
</ui-form-field>
```

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

## FilterSelectComponent

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

---

## Design Tokens

Файл: `frontend/src/styles/_tokens.scss`

```scss
@use '../../../../styles/tokens' as *;
.element { color: $color-primary; padding: $space-4; }
```

| Группа | Ключевые токены |
|--------|----------------|
| Цвета | `$color-primary` (#1976d2), `$color-danger` (#e53935), `$color-success` (#2e7d32) |
| Текст | `$color-text`, `$color-text-muted`, `$color-text-light` |
| Фон/Границы | `$color-bg`, `$color-bg-soft`, `$color-bg-muted`, `$color-border` |
| Отступы | `$space-1..8` (0.25rem..2rem) |
| Типографика | `$font-xs..3xl` (0.75rem..1.75rem) |
| Радиусы | `$radius-sm..2xl` (4px..12px) |
| Тени | `$shadow-sm..xl` |
| Z-index | `$z-modal` (1000), `$z-dialog` (1100), `$z-tooltip` (1200) |

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
- Левый/правый sidebar в `KP Builder` получили немного более выраженный surface contrast, чтобы композиционно “держать” центр.
- По запросу production-печати/визуала: боковые кромки контента КП уменьшены до `5mm` (`kp-sheet__content` horizontal padding), а фоновые заливки внутренних блоков документа (`main/summary/meta/table header`) переведены в прозрачные.

### Toolbar & Top Actions

- Toolbar разбит на две логические группы:
  - `builder__toolbar-main` (назад, title, статус КП),
  - `builder__toolbar-actions` (status badge, secondary actions, primary save).
- Primary action: `Сохранить`.
- Secondary actions: `Предпросмотр`, `PDF / Печать`, `Доп. действия`.
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
- Интерактивность выбора: если после применения наценки/скидки снять галочку у позиции, для этой позиции корректировки сбрасываются (`markup/discount = 0`), и цена строки сразу возвращается к базовой.
- Для каждой позиции показывается формула цены (`База → +%/-% → итог`) для прозрачности расчёта.
- Empty state панели состава сохранён и стилизован в общем системном ключе.
- Блок `Параметры КП` в правой панели использует 2-колоночную сетку на desktop для более плотной работы с числовыми полями; длинное поле `Перенос таблицы...` занимает всю ширину блока.
- На `<=1024px` сетка `Параметры КП` автоматически возвращается в 1 колонку.
- Добавлен параметр `Размер фото (%)` в `Параметры КП` (диапазон `150..350`) с визуальным range-slider + числовым полем.
- Масштаб применяется пропорционально: фото в таблице КП получают одинаковые `width/height` по значению параметра, поэтому изменение размера всегда предсказуемо визуально.
- Для премиального вида таблицы КП ослаблена “решётка”: базовые вертикальные границы сделаны заметно мягче, а акцент оставлен только на ключевых числовых колонках (`qty/unit/price/sum`).

---

## Theme System (light/dark)

- Глобальная тема управляется сервисом `core/services/theme.service.ts`.
- Активная тема выставляется атрибутом `data-theme` на корневом элементе документа.
- Базовые CSS-переменные темы определены в `styles/_global.scss`:
  - `--ui-bg`, `--ui-bg-soft`, `--ui-bg-muted`
  - `--ui-text`, `--ui-text-muted`
  - `--ui-border`, `--ui-border-light`
  - `--ui-primary`
- Переключение темы доступно из `AppShell` (кнопка `🌙 Тёмная / ☀️ Светлая`), выбор сохраняется в `localStorage` (`kppdf-theme`).
- Для новых UI-экранов: фон/текст/границы использовать через `var(--ui-*)`, не хардкодить светлые цвета.
- Для документных блоков КП (`kp-header`, `kp-table`, `kp-document`, `kp-catalog`) также использовать `--ui-*` + `color-mix`, чтобы light/dark и будущая ребрендинг-палитра применялись без локальных hex/rgba правок.
- Для типографики документных блоков КП использовать split-подход: экранные размеры в `rem` (через css custom properties), печатные в `pt` внутри `@media print`, чтобы не разъезжались web-preview и PDF.
- Ключевые feature-экраны переведены на `--ui-*`: `Home`, `Products` (controls/table/card/form), `Counterparties` (filters/table), `Settings`, `Dictionaries`, `Login`, а также `KP Builder`.
- Добавлены системные переменные для финального полиша:
  - `--ui-canvas` (фон viewer/рабочих холстов),
  - `--ui-success`,
  - `--ui-code-bg`, `--ui-code-fg`.
- Глобальные `input/select/textarea` получили единые `focus`/`disabled` состояния (theme-aware).
- `ui-btn` получил унифицированный `focus-visible` ring и консистентное поведение в light/dark.

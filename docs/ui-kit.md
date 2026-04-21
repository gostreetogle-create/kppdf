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
| `.empty-state` | Центрированный пустой блок |
| `.loading-state` | Спиннер + текст |
| `.no-print` | Скрыть при `@media print` |

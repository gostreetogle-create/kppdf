# UI Kit

Все компоненты находятся в `frontend/src/app/shared/ui/`.
Импортируются через barrel: `import { ButtonComponent, ... } from '../../shared/ui/index'`.

---

## ButtonComponent

**Селектор:** `button[ui-btn]`, `a[ui-btn]`

Применяется как атрибут к нативному `<button>` или `<a>`. Стилизует элемент через host-классы.

| Input     | Тип             | По умолчанию | Описание                          |
|-----------|-----------------|--------------|-----------------------------------|
| `variant` | ButtonVariant   | `'default'`  | `default`, `primary`, `danger`, `ghost` |
| `size`    | ButtonSize      | `'md'`       | `sm`, `md`, `lg`                  |
| `icon`    | boolean         | `false`      | Режим иконки: квадратная, без текста |

```html
<!-- Обычная кнопка -->
<button ui-btn>Отмена</button>

<!-- Основное действие -->
<button ui-btn variant="primary">Сохранить</button>

<!-- Опасное действие -->
<button ui-btn variant="danger" size="sm">Удалить</button>

<!-- Кнопка-иконка -->
<button ui-btn icon (click)="close()">✕</button>

<!-- Ссылка как кнопка -->
<a routerLink="/" ui-btn>← Назад</a>

<!-- Задизейбленная -->
<button ui-btn variant="primary" [disabled]="saving()">
  {{ saving() ? 'Сохранение...' : 'Сохранить' }}
</button>
```

---

## BadgeComponent

**Селектор:** `<ui-badge>`

| Input   | Тип        | По умолчанию | Описание                                    |
|---------|------------|--------------|---------------------------------------------|
| `color` | BadgeColor | `'default'`  | `default`, `blue`, `green`, `red`, `orange` |

```html
<ui-badge>Черновик</ui-badge>
<ui-badge color="blue">Отправлен</ui-badge>
<ui-badge color="green">Принят</ui-badge>
<ui-badge color="red">Отклонён</ui-badge>
```

Используется в `HomeComponent` для статусов КП. Цвет определяется через `statusColor(status)`.

---

## ModalComponent

**Селектор:** `<ui-modal>`

| Input      | Тип    | По умолчанию | Описание                    |
|------------|--------|--------------|-----------------------------|
| `title`    | string | `''`         | Заголовок модального окна   |
| `maxWidth` | string | `'540px'`    | Максимальная ширина         |

| Output   | Описание                                    |
|----------|---------------------------------------------|
| `closed` | Эмитируется при клике на ✕ или на backdrop  |

**Слоты (named content projection):**
- `modal-body` — основное содержимое
- `modal-footer` — кнопки действий

```html
<ui-modal title="Новый товар" (closed)="closeForm()">

  <div modal-body>
    <!-- содержимое формы -->
  </div>

  <ng-container modal-footer>
    <button ui-btn (click)="closeForm()">Отмена</button>
    <button ui-btn variant="primary" (click)="submit()">Создать</button>
  </ng-container>

</ui-modal>
```

---

## FormFieldComponent

**Селектор:** `<ui-form-field>`

Обёртка для поля формы. Стилизует вложенные `input`, `textarea`, `select` через `::ng-deep`.

| Input      | Тип     | По умолчанию | Описание                    |
|------------|---------|--------------|-----------------------------|
| `label`    | string  | `''`         | Текст метки                 |
| `required` | boolean | `false`      | Показывает красную звёздочку|
| `error`    | string  | `''`         | Текст ошибки под полем      |
| `hint`     | string  | `''`         | Подсказка под полем         |

```html
<ui-form-field label="Название" [required]="true">
  <input type="text" [(ngModel)]="form.name" />
</ui-form-field>

<ui-form-field label="Цена" [error]="priceError()">
  <input type="number" [(ngModel)]="form.price" />
</ui-form-field>

<ui-form-field label="URL изображения" hint="Ссылка на фото товара">
  <input type="text" [(ngModel)]="form.imageUrl" />
</ui-form-field>
```

---

## AlertComponent

**Селектор:** `<ui-alert>`

| Input  | Тип       | По умолчанию | Описание                              |
|--------|-----------|--------------|---------------------------------------|
| `type` | AlertType | `'error'`    | `error`, `success`, `warning`, `info` |

```html
<!-- Список ошибок формы -->
<ui-alert type="error">
  @for (err of errors(); track err) {
    <div>{{ err }}</div>
  }
</ui-alert>

<!-- Успех -->
<ui-alert type="success">Товар успешно сохранён</ui-alert>
```

---

## Design Tokens

Файл: `frontend/src/styles/_tokens.scss`

Подключение в компоненте:
```scss
@use '../../../../styles/tokens' as *;

.my-block {
  color: $color-primary;
  padding: $space-4;
  border-radius: $radius-md;
  box-shadow: $shadow-sm;
}
```

### Цвета

| Токен                  | Значение   | Использование                  |
|------------------------|------------|--------------------------------|
| `$color-primary`       | `#1976d2`  | Основной акцент, кнопки        |
| `$color-primary-dark`  | `#1565c0`  | Hover состояние primary        |
| `$color-primary-light` | `#e3f2fd`  | Фон badge blue, hover          |
| `$color-danger`        | `#e53935`  | Удаление, ошибки               |
| `$color-danger-light`  | `#ffebee`  | Фон badge red, alert error     |
| `$color-success`       | `#2e7d32`  | Успех, badge green             |
| `$color-text`          | `#1e2937`  | Основной текст                 |
| `$color-text-muted`    | `#64748b`  | Вторичный текст                |
| `$color-text-light`    | `#999`     | Плейсхолдеры, метки            |
| `$color-border`        | `#e0e0e0`  | Границы элементов              |
| `$color-border-light`  | `#f0f0f0`  | Разделители внутри карточек    |
| `$color-bg`            | `#ffffff`  | Фон карточек, модалок          |
| `$color-bg-soft`       | `#fafafa`  | Фон сайдбара, thead таблицы    |
| `$color-bg-muted`      | `#f5f5f5`  | Фон страницы                   |

### Отступы

| Токен      | Значение  |
|------------|-----------|
| `$space-1` | `0.25rem` |
| `$space-2` | `0.5rem`  |
| `$space-3` | `0.75rem` |
| `$space-4` | `1rem`    |
| `$space-5` | `1.25rem` |
| `$space-6` | `1.5rem`  |
| `$space-8` | `2rem`    |

### Типографика

| Токен       | Значение  |
|-------------|-----------|
| `$font-xs`  | `0.75rem` |
| `$font-sm`  | `0.875rem`|
| `$font-base`| `0.9rem`  |
| `$font-md`  | `1rem`    |
| `$font-lg`  | `1.1rem`  |
| `$font-3xl` | `1.75rem` |

### Прочее

| Группа       | Токены                                                  |
|--------------|---------------------------------------------------------|
| Радиусы      | `$radius-sm` (4px), `$radius-md` (6px), `$radius-lg` (8px), `$radius-xl` (10px), `$radius-2xl` (12px) |
| Тени         | `$shadow-sm`, `$shadow-md`, `$shadow-lg`, `$shadow-xl`  |
| Переходы     | `$transition-fast` (0.15s), `$transition-normal` (0.2s) |
| Z-index      | `$z-modal` (1000), `$z-dialog` (1100), `$z-tooltip` (1200) |

---

## Глобальные CSS-классы (`styles/_global.scss`)

| Класс          | Описание                                              |
|----------------|-------------------------------------------------------|
| `.page`        | Контейнер страницы: max-width 1400px, padding 2rem    |
| `.page-header` | Flex-строка: заголовок слева, действия справа         |
| `.page-toolbar`| Flex-строка для поиска и фильтров                     |
| `.empty-state` | Центрированный блок для пустого состояния             |
| `.loading-state`| Центрированный блок с анимированным спиннером        |
| `.no-print`    | Скрывается при печати (`@media print`)                |

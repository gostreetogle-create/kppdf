# Roadmap по улучшению дизайна KP PDF (UI/UX)

Реалистичный low-risk план для текущего стека: Angular + SCSS + собственные UI-токены.

## 1) Baseline-аудит (шаблон)

## 1.1 Инвентаризация токенов

Заполняется по фактическим файлам токенов проекта.

- Цвета:
  - `--color-primary`
  - `--color-secondary`
  - `--color-accent`
  - `--color-background`
  - `--color-surface`
  - `--color-text-*`
  - `--color-status-*`
- Типографика:
  - `font-size` scale
  - `line-height`
  - `font-weight`
- Пространство и форма:
  - `--spacing-*`
  - `--radius-*`
  - `--shadow-*`
  - `--border-*`

## 1.2 Карта экранов для проверки

- `KP Builder` (приоритет P0)
- `Home`
- `Counterparties`
- `Roles & Permissions`
- Общие паттерны: модалки, таблицы, формы, тосты/алерты

## 1.3 Таблица находок (шаблон)

- Экран:
- Компонент/блок:
- Проблема:
- Тип:
  - `contrast`
  - `focus`
  - `disabled`
  - `typography`
  - `spacing`
  - `state-consistency`
- Severity:
  - `P0` / `P1` / `P2`
- Скриншот/ссылка:
- Рекомендация фикса:

## 1.4 WCAG чек (минимум AA)

- Нормальный текст: контраст не ниже `4.5:1`
- Крупный текст: контраст не ниже `3:1`
- Видимый `focus-visible` у всех интерактивных элементов
- `disabled` визуально читаем и недоступен для взаимодействия

---

## 2) Design Specification v1 (токены)

Ниже целевая семантика, внедряется через существующий слой SCSS-токенов.

## 2.1 Цветовые токены

```scss
/* Core semantic colors */
--color-primary: #2563eb;
--color-primary-hover: #1d4ed8;
--color-primary-active: #1e40af;
--color-primary-disabled: #93c5fd;

--color-secondary: #f59e42;
--color-secondary-hover: #fbbf24;
--color-secondary-active: #d97706;
--color-secondary-disabled: #fde68a;

--color-accent: #10b981;
--color-accent-hover: #059669;
--color-accent-active: #047857;
--color-accent-disabled: #a7f3d0;

--color-success: #10b981;
--color-warning: #f59e42;
--color-error: #ef4444;
--color-info: #3b82f6;

--color-background: #f9fafb;
--color-surface: #ffffff;
--color-surface-hover: #f3f4f6;
--color-surface-active: #e5e7eb;
--color-border: #d1d5db;

--color-text-primary: #1f2937;
--color-text-secondary: #6b7280;
--color-text-tertiary: #9ca3af;
--color-text-disabled: #9ca3af;
--color-text-on-primary: #ffffff;

--color-focus-ring: #2563eb;
```

## 2.2 Типографика (рекомендуемая шкала)

```scss
--font-size-h1: 2rem;      /* 32px */
--font-size-h2: 1.5rem;    /* 24px */
--font-size-h3: 1.25rem;   /* 20px */

--font-size-body-lg: 1rem;     /* 16px */
--font-size-body: 0.875rem;    /* 14px */
--font-size-body-sm: 0.8125rem;/* 13px */
--font-size-caption: 0.75rem;  /* 12px */

--line-height-h1: 1.2;
--line-height-h2: 1.25;
--line-height-h3: 1.3;
--line-height-body: 1.5;
--line-height-caption: 1.4;

--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

## 2.3 Spacing / shape

```scss
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-10: 40px;
--spacing-12: 48px;

--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

---

## 3) P0 checklist (перед любыми визуальными полировками)

- Контраст критичных сочетаний соответствует WCAG AA.
- Все интерактивные элементы имеют явный `focus-visible`.
- `disabled` состояния единообразны и визуально отличимы.
- Базовая типографическая иерархия внедрена (h1/h2/h3/body/caption).
- На ключевых экранах убраны hardcoded-цвета и размеры в пользу токенов.

---

## 4) Пример `ui-button.component.scss` (референс)

```scss
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  font-weight: var(--font-weight-semibold);
  padding: var(--spacing-2) var(--spacing-4);
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
  cursor: pointer;
}

.ui-btn:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.ui-btn--primary {
  background: var(--color-primary);
  color: var(--color-text-on-primary);
}

.ui-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.ui-btn--primary:active:not(:disabled) {
  background: var(--color-primary-active);
}

.ui-btn:disabled,
.ui-btn[aria-disabled='true'] {
  background: var(--color-primary-disabled);
  border-color: var(--color-primary-disabled);
  color: var(--color-text-on-primary);
  cursor: not-allowed;
  opacity: 0.72;
}
```

---

## 5) Порядок внедрения (коротко)

1. Аудит и фиксация проблем (без правок кода).
2. Утверждение токенов v1.
3. Обновление базовых UI-компонентов (`button`, `form-field`, `alert`, `badge`).
4. Проход по `KP Builder` и двум следующим ключевым экранам.
5. Regression pass + обновление документации.

---

## 6) Week 2 — Stabilization (PR1)

### 6.1 PDF Polish

- Добавить utility-классы печати в `kp-document`:
  - `.page-break-before { break-before: page; }`
  - `.avoid-break { break-inside: avoid; }`
- Включить Puppeteer `displayHeaderFooter`:
  - header: название КП + дата;
  - footer: `Страница X из Y`.
- Acceptance:
  - длинные строки товаров не рвутся посередине;
  - у многостраничного PDF есть стабильная нумерация.

### 6.2 UX Safety

- Локальный backup КП в `localStorage` параллельно с autosave.
- При reload показывать модалку восстановления черновика.
- Acceptance:
  - потеря сети/refresh не приводит к потере ручных правок;
  - пользователь явно выбирает «восстановить» или «игнорировать».

### 6.3 Perceived Performance

- В `KpBuilder` использовать Apple-style skeleton вместо текста/спиннера.
- Skeleton повторяет структуру экрана: toolbar + 3 колонки (sidebar / preview / sidebar).

### 6.4 Instant UX

- Optimistic update для операций с серверным roundtrip (например `switchKpType`).
- При ошибке backend выполнять rollback локального состояния + показывать toast.
- Добавить `Undo/Redo` (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`) с историей последних 10 снапшотов.

---

## Section 7: Release QA Gate (Acceptance Criteria)

Не мержим изменения в релизную ветку, пока не проставлены все пункты ниже.

### 7.1 PDF QA

- Одностраничное КП:
  - Сформировать `Скачать PDF (HQ)` для документа с 1-3 позициями.
  - Проверить наличие логотипа компании, фонов и фото товаров.
- Многостраничное КП:
  - Сформировать PDF для документа на 2+ страницы.
  - Проверить отсутствие обрезания строк и корректные переносы между страницами.
- Asset-path reliability:
  - Проверить загрузку изображений при стандартном origin.
  - Проверить загрузку изображений с абсолютным путём (через `PDF_ASSET_BASE_URL`, если используется отдельный media/CDN origin).
- Кликабельность ссылок:
  - Проверить, что ссылки в PDF (website/email/URL) остаются активными после экспорта.
- Вес файла:
  - Проверить, что PDF с 5 фото остаётся пригодным для отправки по почте (без аномального раздувания размера файла).

### 7.2 Storybook Keyboard QA

- `UI/Button`: `Tab/Shift+Tab` показывают стабильный `focus-visible` ring во всех вариантах.
- `UI/Search Input`: keyboard focus отчётливо виден, контур не теряется на светлой/тёмной теме.
- `UI/Form Field` и `FilterSelect`: единый стиль фокуса и достаточный контраст ring.
- Esc-cancel:
  - В сценарии инлайнового редактирования цены (KP документ) клавиша `Esc` должна откатывать значение и корректно завершать interaction (без потери фокуса в “пустоту”).

### 7.3 Smoke / UX Resilience

- Type checks:
  - `npx tsc --noEmit` в `frontend`
  - `npx tsc --noEmit` в `backend`
- Storybook smoke:
  - `npm run build-storybook`
- Restore Flow:
  - Открыть КП, изменить заголовок, обновить страницу (`F5`), нажать `Восстановить` в модалке.
  - Проверить, что изменения корректно возвращаются и редактор остаётся в валидном состоянии.


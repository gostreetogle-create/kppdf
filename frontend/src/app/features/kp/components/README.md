# Компоненты КП (Коммерческое предложение)

Набор переиспользуемых компонентов для создания коммерческих предложений в формате A4.

## Структура компонентов

### 🎨 Основные компоненты

#### `KpBackgroundComponent`
Компонент-обертка с фоновым изображением для листа A4.

**Входные параметры:**
- `imageUrl: string` - URL фонового изображения

**Использование:**
```html
<app-kp-background [imageUrl]="'/kp/kp-1str.png'">
  <!-- Содержимое КП -->
</app-kp-background>
```

#### `KpDocumentComponent`
Полный компонент коммерческого предложения, объединяющий все части.

**Особенности:**
- Готовый к использованию КП
- Демонстрационные данные
- Оптимизирован для печати A4

---

### 🧩 Переиспользуемые компоненты

#### `KpHeaderComponent`
Шапка КП с информацией о получателе и метаданными.

**Входные параметры:**
- `recipient: KpRecipient` - данные получателя
- `metadata: KpMetadata` - метаданные КП

**Типы:**
```typescript
interface KpRecipient {
  name: string;
  inn?: string;
  email?: string;
  phone?: string;
}

interface KpMetadata {
  number: string;
  createdAt: Date;
  validityDays: number;
  prepaymentPercent: number;
  productionDays: number;
}
```

#### `KpCatalogComponent`
Таблица товаров с настраиваемыми колонками.

**Входные параметры:**
- `items: KpCatalogItem[]` - список товаров
- `showPhotoColumn: boolean` - показать колонку "Фото" (по умолчанию: true)
- `showDescriptionColumn: boolean` - показать колонку "Описание" (по умолчанию: true)

**Тип товара:**
```typescript
interface KpCatalogItem {
  id: number;
  name: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  imageUrl: string;
}
```

#### `KpTableComponent`
Блок итогов и дополнительных условий.

**Входные параметры:**
- `totals: KpTotals` - итоговые суммы
- `conditions: string[]` - дополнительные условия (опционально)

**Тип итогов:**
```typescript
interface KpTotals {
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
}
```

---

## 📋 Примеры использования

### Полное КП
```html
<app-kp-background [imageUrl]="backgroundUrl">
  <app-kp-header 
    [recipient]="recipient" 
    [metadata]="metadata">
  </app-kp-header>

  <main class="kp-content">
    <app-kp-catalog 
      [items]="items"
      [showPhotoColumn]="true"
      [showDescriptionColumn]="true">
    </app-kp-catalog>

    <app-kp-table 
      [totals]="totals"
      [conditions]="conditions">
    </app-kp-table>
  </main>
</app-kp-background>
```

### Только таблица товаров
```html
<app-kp-catalog 
  [items]="products"
  [showPhotoColumn]="false"
  [showDescriptionColumn]="true">
</app-kp-catalog>
```

### Только итоги
```html
<app-kp-table 
  [totals]="totals">
</app-kp-table>
```

---

## 🎯 Особенности

### Адаптивность
- Оптимизировано для формата A4 (210×297mm)
- Корректное отображение при печати
- Сохранение пропорций фонового изображения

### Стилизация
- Современная типографика
- Профессиональная цветовая схема
- Четкая сетка и выравнивание
- CSS Grid для гибкой компоновки

### Переиспользование
- Модульная архитектура
- Типизированные интерфейсы
- Настраиваемые параметры
- Независимые компоненты

---

## 🚀 Маршруты

- `/kp` - Полное коммерческое предложение
- `/catalog` - Пример переиспользования таблицы товаров

---

## 📁 Структура файлов

```
kp/components/
├── kp-background/          # Фоновый компонент A4
├── kp-document/           # Полный документ КП
├── kp-header/             # Шапка с получателем и метаданными
├── kp-catalog/            # Таблица товаров
├── kp-table/              # Итоги и условия
├── index.ts               # Экспорты компонентов
└── README.md              # Документация
```
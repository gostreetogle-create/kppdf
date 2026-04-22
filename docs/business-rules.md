# Business Rules

## Статусы КП

```
draft ──→ sent ──→ accepted
                ↘ rejected ──→ draft
```

| Статус | Значение | Редактирование | Кто устанавливает |
|--------|----------|----------------|-------------------|
| `draft` | Черновик | Полное | manager, admin, owner |
| `sent` | Отправлен клиенту | Только статус | manager, admin, owner |
| `accepted` | Клиент принял | Только просмотр | admin, owner |
| `rejected` | Клиент отклонил | Только просмотр | admin, owner |

Допустимые переходы: `draft→sent`, `sent→accepted`, `sent→rejected`, `rejected→draft`  
Реализовано в `shared/types/Kp.ts` → `KP_STATUS_TRANSITIONS`

Ограничение редактирования на фронтенде реализовано: при `sent` и `accepted` редактор КП работает в режиме read-only.

---

## RBAC роли и permissions

| Роль | Permissions |
|------|-------------|
| `owner` | Все (`kp.*`, `products.*`, `counterparties.crud`, `settings.write`, `backups.manage`, `users.manage`) |
| `admin` | Все, кроме системного владения (фактически та же рабочая матрица) |
| `manager` | `kp.create`, `kp.edit`, `kp.view`, `products.view`, `counterparties.crud` |
| `viewer` | `kp.view`, `products.view` |

Правила enforcement:
- backend authoritative: каждый защищённый endpoint проходит через `requirePermission(permission)`;
- frontend использует `permissionsService.can(permission)` и `*appCan` только для UI-видимости;
- при `mustChangePassword=true` пользователь блокируется от рабочих endpoint'ов до смены пароля.
- управление пользователями (`users.manage`) включает CRUD-поток: создание, редактирование (имя/роль/статус), сброс пароля и удаление (кроме self-delete).
- защитное правило безопасности: пользователь с ролью `owner` не может изменить свой собственный `username` (логин), чтобы не терять устойчивую точку входа владельца.

---

## Расчёт итогов КП

Только на фронтенде (`KpBuilderComponent` computed signals). В MongoDB **не хранятся**.

```
effectiveUnitPrice = round(item.price × (1 + markup%/100) × (1 - discount%/100))
  where:
  - markup% применяется только если `markupEnabled = true` (0..500)
  - discount% применяется только если `discountEnabled = true` (0..100)

subtotal  = Σ (effectiveUnitPrice × item.qty)
vatAmount = round(subtotal × vatPercent / 100)
total     = subtotal + vatAmount
```

---

## Товары в КП — снимок данных

При добавлении товара данные **копируются** из каталога (`productId`, `code`, `name`, `description`, `unit`, `price`, `imageUrl`).  
Изменение товара в каталоге **не влияет** на существующие КП.

---

## Логика редактора КП

- Добавить товар: если уже есть — `qty++`, иначе новая позиция с `qty=1`
- Для корректировок цены используется массовое применение к выбранным строкам:
  - у позиции есть чекбокс `Выбрать`;
  - в панели `Состав КП` задаются `% Наценка` (до 500) и `% Скидка` (до 100);
  - кнопки `Применить к выбранным` записывают значения в поля позиции;
  - кнопка `Сбросить наценку/скидку` очищает корректировки у выбранных позиций.
- В `Состав КП` всегда показывается фото позиции (если есть `imageUrl`)
- Изменить qty: минимум 1
- Удалить позицию: явной кнопкой `Удалить` для конкретной строки (по `productId`)
- Автосохранение: debounce 2 сек после изменения в КП, но только после первой добавленной товарной позиции (`items.length > 0`) → `PUT /api/kp/:id`
- Ручное сохранение: немедленно, сбрасывает debounce
- Блок `Параметры КП` в `KpBuilder` редактирует `metadata.number`, `metadata.validityDays`, `metadata.prepaymentPercent`, `metadata.productionDays`, `vatPercent`
- Поле `metadata.tablePageBreakAfter` задаёт, после какой строки таблицы делать перенос на новую страницу (используется как `itemsPerPage` в документе)
- Для нового КП значения по умолчанию берутся из `Settings` на бэкенде (frontend не должен подставлять локальные дефолты)
- Резервные копии (MongoDB + media) управляются централизованно через `/settings` (раздел "Бэкапы"): ручной запуск, поиск/фильтрация, скачивание, удаление и очистка старше N дней; операции требуют `backups.manage`
- Разрушительные действия в UI (`удаление записи справочника`, `удаление/cleanup бэкапов`) подтверждаются только через `ModalService` + `ui-modal`; системный `window.confirm` не допускается.
- Новый получатель из редактора КП: кнопка «+» открывает ту же форму контрагента в модальном окне на странице КП (`shared/components/counterparty-form`); после сохранения контрагент попадает в локальный список сайдбара и сразу выбирается как получатель (`Kp.recipient` — snapshot). Уход со страницы при несохранённом КП — через `ui-modal`, не системный `confirm`

---

## Многостраничность документа A4

`KpDocumentComponent` разбивает items на страницы (`itemsPerPage = 6` по умолчанию):
- Стр. 1: фон `kp-1str.png` + `KpHeaderComponent` (получатель + метаданные)
- Стр. 2+: фон `kp-2str.png`, без шапки, `margin-top: 20mm`
- Последняя стр.: `KpTableComponent` (итоги + условия)
- Номера страниц — если страниц > 1

---

## Печать / PDF

`window.print()` — браузерная печать.  
Элементы с классом `.no-print` скрываются через `@media print`.  
Скрывается: тулбар builder, сайдбар, кнопки действий.  
Остаётся: только `KpDocumentComponent` (страницы A4).

---

## Контрагенты

- Одна компания может совмещать роли (`role: ['client', 'supplier']`)
- Отдельная роль `company` используется для нашей компании (`isOurCompany=true`) как источника реквизитов/фона/footer в КП
- ИНН: 10 цифр (юрлицо) или 12 цифр (ИП) — валидация в Mongoose
- КПП: 9 цифр, только для юрлиц — валидация в Mongoose
- Поиск по ИНН: `GET /api/counterparties/lookup?inn=` → DaData API (требует `DADATA_TOKEN`)

---

## Нумерация КП

Серверная генерация номера в `POST /api/kp` и `POST /api/kp/:id/duplicate`.

Формат: `КП-001`, `КП-002`, `КП-003`...

Правило:
- берутся только номера формата `КП-\d+`;
- находится максимальный существующий serial;
- новый номер = `max + 1` (с `padStart(3, '0')`).

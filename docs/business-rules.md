# Business Rules

## Статусы КП

```
draft ──→ sent ──→ accepted
                ↘ rejected ──→ draft
```

| Статус | Значение | Редактирование | Кто устанавливает |
|--------|----------|----------------|-------------------|
| `draft` | Черновик | Полное | manager, admin |
| `sent` | Отправлен клиенту | Только статус | manager, admin |
| `accepted` | Клиент принял | Только просмотр | admin |
| `rejected` | Клиент отклонил | Только просмотр | admin |

Допустимые переходы: `draft→sent`, `sent→accepted`, `sent→rejected`, `rejected→draft`  
Реализовано в `shared/types/Kp.ts` → `KP_STATUS_TRANSITIONS`

Ограничение редактирования на фронтенде реализовано: при `sent` и `accepted` редактор КП работает в режиме read-only.  
Проверка ролей (`admin/manager`) остаётся TODO.

---

## Роли пользователей

| Роль | Возможности |
|------|-------------|
| `admin` | Все операции, все переходы статусов |
| `manager` | CRUD товаров, CRUD КП, переход статуса только `draft→sent` |

Ограничения реализованы:
- backend: `settings` и `dictionaries` доступны только `admin` (`403` при недостатке прав);
- backend: для `manager` запрещены переходы статусов КП кроме `draft→sent`;
- frontend: маршруты `/settings` и `/dictionaries` защищены `adminGuard`, ссылки скрыты для `manager`.

---

## Расчёт итогов КП

Только на фронтенде (`KpBuilderComponent` computed signals). В MongoDB **не хранятся**.

```
subtotal  = Σ (item.price × item.qty)
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
- Добавить вручную: если товара нет в каталоге, позиция создаётся из формы в блоке `Состав КП` (name/code/unit/price/qty)
- Изменить qty: минимум 1
- Удалить позицию: явной кнопкой `Удалить` для конкретной строки (по `productId`)
- Автосохранение: debounce 2 сек после изменения в КП, но только после первой добавленной товарной позиции (`items.length > 0`) → `PUT /api/kp/:id`
- Ручное сохранение: немедленно, сбрасывает debounce
- Блок `Параметры КП` в `KpBuilder` редактирует `metadata.number`, `metadata.validityDays`, `metadata.prepaymentPercent`, `metadata.productionDays`, `vatPercent`
- Поле `metadata.tablePageBreakAfter` задаёт, после какой строки таблицы делать перенос на новую страницу (используется как `itemsPerPage` в документе)
- Для нового КП значения по умолчанию берутся из `Settings` на бэкенде (frontend не должен подставлять локальные дефолты)
- Новый получатель из редактора КП: кнопка «+» открывает ту же форму контрагента в модальном окне на странице КП (`shared/components/counterparty-form`); после сохранения контрагент попадает в локальный список сайдбара и сразу выбирается как получатель (`Kp.recipient` — snapshot). Уход со страницы при несохранённом КП — через `ui-modal`, не системный `confirm`

---

## Многостраничность документа A4

`KpDocumentComponent` разбивает items на страницы (`itemsPerPage = 10`):
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

import { Schema, model, Document } from 'mongoose';

export interface ISetting extends Document {
  key:   string;
  value: unknown;
  label: string;
}

const SettingSchema = new Schema<ISetting>({
  key:   { type: String, required: true, unique: true, trim: true },
  value: { type: Schema.Types.Mixed, required: true },
  label: { type: String, required: true },
}, { timestamps: true });

export const Setting = model<ISetting>('Setting', SettingSchema);

// Дефолтные настройки системы
export const DEFAULT_SETTINGS = [
  { key: 'kp_validity_days',      value: 10,  label: 'Срок действия КП (раб. дней)' },
  { key: 'kp_prepayment_percent', value: 80,  label: 'Предоплата (%)' },
  { key: 'kp_production_days',    value: 25,  label: 'Срок изготовления (раб. дней)' },
  { key: 'kp_vat_percent',        value: 22,  label: 'НДС (%)' },
  { key: 'passport_warranty_text', value: 'Гарантия на изделие составляет 12 месяцев с даты ввода в эксплуатацию.', label: 'Текст гарантии в техническом паспорте' },
  { key: 'passport_storage_text', value: 'Изделие хранить в сухом помещении, исключить длительное воздействие влаги и агрессивной среды.', label: 'Текст хранения и транспортировки в техническом паспорте' },
  {
    key: 'product_spec_templates_v1',
    value: [],
    label: 'Шаблоны ProductSpec (groups/params)'
  },
  {
    key: 'rbac_labels',
    value: {
      roles: {
        owner: 'Owner',
        admin: 'Admin',
        manager: 'Manager',
        viewer: 'Viewer'
      },
      permissions: {
        'kp.create': 'Создание КП',
        'kp.edit': 'Редактирование КП',
        'kp.delete': 'Удаление КП',
        'kp.view': 'Просмотр КП',
        'products.write': 'Управление товарами',
        'products.view': 'Просмотр товаров',
        'counterparties.crud': 'Управление контрагентами',
        'settings.write': 'Изменение настроек',
        'backups.manage': 'Управление бэкапами',
        'users.manage': 'Управление пользователями'
      }
    },
    label: 'Подписи RBAC (роли и полномочия)'
  },
];

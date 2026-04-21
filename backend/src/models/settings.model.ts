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
];

import { Schema, model, Document } from 'mongoose';

export type LegalForm    = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'Физлицо' | 'Другое';
export type CpRole       = 'client' | 'supplier';
export type CpStatus     = 'active' | 'inactive';

export interface IContact {
  name:      string;
  position?: string;
  phone?:    string;
  email?:    string;
}

export interface ICounterparty extends Document {
  legalForm:            LegalForm;
  role:                 CpRole[];
  name:                 string;       // Полное: ООО "СпортИН-ЮГ"
  shortName:            string;       // Краткое: СпортИН-ЮГ
  inn:                  string;
  kpp?:                 string;       // Только для юрлиц
  ogrn?:                string;
  legalAddress?:        string;
  actualAddress?:       string;
  sameAddress:          boolean;
  phone?:               string;
  email?:               string;
  website?:             string;
  contacts:             IContact[];
  bankName?:            string;
  bik?:                 string;
  checkingAccount?:     string;
  correspondentAccount?:string;
  founderName?:         string;       // ФИО для ИП: Иванов Иван Иванович
  founderNameShort?:    string;       // И.И. Иванов
  status:               CpStatus;
  notes?:               string;
  tags:                 string[];
}

const ContactSchema = new Schema<IContact>({
  name:     { type: String, required: true },
  position: String,
  phone:    String,
  email:    String,
}, { _id: false });

const CounterpartySchema = new Schema<ICounterparty>({
  legalForm:  {
    type: String,
    enum: ['ООО', 'ИП', 'АО', 'ПАО', 'Физлицо', 'Другое'],
    required: true
  },
  role: {
    type: [String],
    enum: ['client', 'supplier'],
    default: ['client']
  },
  name:      { type: String, required: true, trim: true },
  shortName: { type: String, required: true, trim: true },
  inn:       { type: String, required: true, trim: true, match: [/^\d{10}(\d{2})?$/, 'ИНН должен содержать 10 или 12 цифр'] },
  kpp:       { type: String, trim: true, match: [/^\d{9}$/, 'КПП должен содержать 9 цифр'] },
  ogrn:      { type: String, trim: true },

  legalAddress:  String,
  actualAddress: String,
  sameAddress:   { type: Boolean, default: false },

  phone:   String,
  email:   String,
  website: String,
  contacts: { type: [ContactSchema], default: [] },

  bankName:             String,
  bik:                  String,
  checkingAccount:      String,
  correspondentAccount: String,

  founderName:      String,
  founderNameShort: String,

  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes:  String,
  tags:   { type: [String], default: [] },
}, { timestamps: true });

// Индексы для быстрого поиска
CounterpartySchema.index({ inn: 1 });
CounterpartySchema.index({ name: 'text', shortName: 'text' });

export const Counterparty = model<ICounterparty>('Counterparty', CounterpartySchema);

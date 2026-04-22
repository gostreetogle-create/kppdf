import { Schema, model, Document } from 'mongoose';

export type LegalForm    = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'МКУ' | 'Физлицо' | 'Другое';
export type CpRole       = 'client' | 'supplier';
export type CpStatus     = 'active' | 'inactive';
export type ImageContext  = 'product' | 'kp-page1' | 'kp-page2' | 'passport';

export interface IContact {
  name:      string;
  position?: string;
  phone?:    string;
  email?:    string;
}

export interface IImage {
  url:       string;
  isMain:    boolean;
  sortOrder: number;
  context?:  ImageContext;  // optional, default: 'product'
}

export interface ICounterparty extends Document {
  legalForm:            LegalForm;
  role:                 CpRole[];
  name:                 string;
  shortName:            string;
  inn:                  string;
  kpp?:                 string;
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
  founderName?:         string;
  founderNameShort?:    string;
  status:               CpStatus;
  notes?:               string;
  tags:                 string[];
  // Company profile fields
  isOurCompany:         boolean;
  images:               IImage[];   // context: kp-page1, kp-page2, passport
  footerText?:          string;     // HTML — текст внизу КП
}

const ContactSchema = new Schema<IContact>({
  name:     { type: String, required: true },
  position: String,
  phone:    String,
  email:    String,
}, { _id: false });

const ImageSchema = new Schema<IImage>({
  url:       { type: String, required: true },
  isMain:    { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  context:   { type: String, enum: ['product', 'kp-page1', 'kp-page2', 'passport'], required: true },
}, { _id: false });

const CounterpartySchema = new Schema<ICounterparty>({
  legalForm: {
    type: String,
    enum: { values: ['ООО', 'ИП', 'АО', 'ПАО', 'МКУ', 'Физлицо', 'Другое'], message: 'Некорректная организационно-правовая форма' },
    required: [true, 'Орг. форма обязательна']
  },
  role: { type: [String], enum: { values: ['client', 'supplier', 'company'], message: 'Некорректная роль контрагента' }, default: ['client'] },
  name:      { type: String, required: [true, 'Полное название обязательно'], trim: true },
  shortName: { type: String, required: [true, 'Краткое название обязательно'], trim: true },
  inn: {
    type: String,
    trim: true,
    required: [
      function(this: ICounterparty) { return this.legalForm !== 'Физлицо'; },
      'ИНН обязателен'
    ],
    validate: {
      validator(this: ICounterparty, value: string) {
        const inn = (value ?? '').trim();
        if (!inn) return this.legalForm === 'Физлицо';
        return /^\d{10}(\d{2})?$/.test(inn);
      },
      message: 'ИНН должен содержать 10 или 12 цифр'
    }
  },
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

  status: { type: String, enum: { values: ['active', 'inactive'], message: 'Некорректный статус контрагента' }, required: [true, 'Статус обязателен'], default: 'active' },
  notes:  String,
  tags:   { type: [String], default: [] },

  // Company profile
  isOurCompany: { type: Boolean, default: false },
  images:       { type: [ImageSchema], default: [] },
  footerText:   { type: String, default: '' },
}, { timestamps: true });

CounterpartySchema.index({ inn: 1 });
CounterpartySchema.index({ name: 'text', shortName: 'text' });
CounterpartySchema.index({ isOurCompany: 1 });

export const Counterparty = model<ICounterparty>('Counterparty', CounterpartySchema);

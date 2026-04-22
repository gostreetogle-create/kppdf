import { Schema, model, Document } from 'mongoose';

export type LegalForm    = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'МКУ' | 'Физлицо' | 'Другое';
export type CpRole       = 'client' | 'supplier' | 'company';
export type CpStatus     = 'active' | 'inactive';
export type ImageContext  = 'product' | 'kp-page1' | 'kp-page2' | 'passport';
export type KpType = 'standard' | 'response' | 'special' | 'tender' | 'service';

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
  isDefaultInitiator?:  boolean;
  images:               IImage[];   // context: kp-page1, kp-page2, passport
  footerText?:          string;     // HTML — текст внизу КП
  brandingTemplates: Array<{
    key: string;
    name: string;
    kpType: KpType;
    isDefault: boolean;
    assets: {
      kpPage1: string;
      kpPage2?: string;
      passport?: string;
      appendix?: string;
    };
    conditions?: string[];
  }>;
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

const BrandingTemplateSchema = new Schema({
  key:      { type: String, required: true, trim: true },
  name:     { type: String, required: true, trim: true },
  kpType:   { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
  isDefault:{ type: Boolean, default: false },
  assets: {
    kpPage1:  { type: String, required: true, trim: true },
    kpPage2:  { type: String, trim: true },
    passport: { type: String, trim: true },
    appendix: { type: String, trim: true },
  },
  conditions: { type: [String], default: [] }
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
  isDefaultInitiator: { type: Boolean, default: false },
  images:       { type: [ImageSchema], default: [] },
  footerText:   { type: String, default: '' },
  brandingTemplates: { type: [BrandingTemplateSchema], default: [] },
}, { timestamps: true });

CounterpartySchema.pre('validate', function(next) {
  const templates = Array.isArray(this.brandingTemplates) ? this.brandingTemplates : [];

  const keys = new Set<string>();
  for (const template of templates) {
    const key = String(template?.key ?? '').trim();
    if (!key) return next(new Error('У шаблона брендирования обязателен ключ'));
    if (keys.has(key)) return next(new Error(`Ключ шаблона "${key}" должен быть уникальным в рамках компании`));
    keys.add(key);

    const kpPage1 = String(template?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      return next(new Error(`Шаблон "${template?.name || key}" должен содержать фон первой страницы (assets.kpPage1)`));
    }
  }

  const kpTypes: KpType[] = ['standard', 'response', 'special', 'tender', 'service'];
  for (const kpType of kpTypes) {
    const defaults = templates.filter((template: any) => template?.kpType === kpType && template?.isDefault === true);
    if (defaults.length > 1) {
      return next(new Error(`Для типа КП "${kpType}" может быть только один шаблон по умолчанию`));
    }
  }

  return next();
});

CounterpartySchema.index({ inn: 1 });
CounterpartySchema.index({ name: 'text', shortName: 'text' });
CounterpartySchema.index({ isOurCompany: 1 });

export const Counterparty = model<ICounterparty>('Counterparty', CounterpartySchema);

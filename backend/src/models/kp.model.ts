import { Schema, model, Document } from 'mongoose';
import { 
  IKp as ISharedKp, 
  KpStatus, 
  KpType, 
  KpItem, 
  KpRecipient, 
  KpMetadata,
  KpVersionMeta
} from '../../../shared/types/Kp';

export interface IKp extends Omit<ISharedKp, '_id' | 'createdAt' | 'updatedAt' | 'items' | 'recipient' | 'metadata' | 'companySnapshot' | 'versions'>, Document {
  recipient: KpRecipient;
  metadata: KpMetadata & {
    tablePageBreakAfter: number;
  };
  items: KpItem[];
  versions?: Array<Omit<KpVersionMeta, 'createdAt'> & { createdAt: Date }>;
  companySnapshot: {
    companyId: Schema.Types.ObjectId | string;
    companyName: string;
    templateKey: string;
    templateName: string;
    kpType: KpType;
    assets: {
      kpPage1: string;
      kpPage2?: string;
      passport?: string;
      appendix?: string;
    };
    texts: {
      headerNote?: string;
      introText?: string;
      footerText?: string;
      closingText?: string;
    };
    requisitesSnapshot?: {
      inn?: string;
      kpp?: string;
      ogrn?: string;
      bik?: string;
      checkingAccount?: string;
      correspondentAccount?: string;
      phone?: string;
      email?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const INN_REGEX = /^\d{10}(\d{2})?$/;
const BIK_REGEX = /^\d{9}$/;
const ACCOUNT_REGEX = /^\d{20}$/;

const KpItemSchema = new Schema<KpItem>({
  productId:   { type: String, required: true },
  code:        { type: String },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  unit:        { type: String, required: true },
  price:       { type: Number, required: true },
  qty:         { type: Number, required: true, default: 1, min: [1, 'qty должен быть >= 1'] },
  imageUrl:    { type: String, default: '' },
  markupEnabled:   { type: Boolean, default: false },
  markupPercent:   { type: Number, default: 0, min: [0, 'markupPercent должен быть >= 0'] },
  discountEnabled: { type: Boolean, default: false },
  discountPercent: { type: Number, default: 0, min: [0, 'discountPercent должен быть >= 0'], max: [100, 'discountPercent должен быть <= 100'] },
}, { _id: false });

const KpVersionSchema = new Schema({
  version: { type: Number, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], required: true },
  number: { type: String, required: true },
  title: { type: String, required: true },
  kpType: { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
  counterpartyId: { type: String },
  companyId: { type: String },
  recipient: {
    name:                  { type: String, default: '' },
    shortName:             String,
    legalForm:             String,
    inn:                   { type: String, match: [INN_REGEX, 'ИНН должен содержать 10 или 12 цифр'] },
    kpp:                   String,
    ogrn:                  String,
    legalAddress:          String,
    phone:                 String,
    email:                 String,
    bankName:              String,
    bik:                   { type: String, match: [BIK_REGEX, 'БИК должен содержать 9 цифр'] },
    checkingAccount:       { type: String, match: [ACCOUNT_REGEX, 'Расчетный счет должен содержать 20 цифр'] },
    correspondentAccount:  { type: String, match: [ACCOUNT_REGEX, 'Корреспондентский счет должен содержать 20 цифр'] },
    founderName:           String,
    founderNameShort:      String,
  },
  metadata: {
    number:            { type: String, required: true },
    validityDays:      { type: Number, default: 10 },
    prepaymentPercent: { type: Number, default: 50 },
    productionDays:    { type: Number, default: 15 },
    tablePageBreakAfter: { type: Number, default: 6, min: [1, 'tablePageBreakAfter должен быть >= 1'] },
    tablePageBreakFirstPage: { type: Number, default: 4, min: [1, 'tablePageBreakFirstPage должен быть >= 1'] },
    tablePageBreakNextPages: { type: Number, default: 6, min: [1, 'tablePageBreakNextPages должен быть >= 1'] },
    photoScalePercent: { type: Number, default: 600, min: [0, 'photoScalePercent должен быть >= 0'], max: [1000, 'photoScalePercent должен быть <= 1000'] },
    photoCropPercent: { type: Number, default: 0, min: [0, 'photoCropPercent должен быть >= 0'], max: [50, 'photoCropPercent должен быть <= 50'] },
    showPhotoColumn: { type: Boolean, default: true },
    defaultMarkupPercent: { type: Number, default: 0, min: [0, 'defaultMarkupPercent должен быть >= 0'], max: [500, 'defaultMarkupPercent должен быть <= 500'] },
    defaultDiscountPercent: { type: Number, default: 0, min: [0, 'defaultDiscountPercent должен быть >= 0'], max: [100, 'defaultDiscountPercent должен быть <= 100'] },
  },
  items: { type: [KpItemSchema], default: [] },
  conditions: { type: [String], default: [] },
  vatPercent: { type: Number, default: 20 },
  companySnapshot: {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Counterparty',
      required: true
    },
    companyName: { type: String, required: true },
    templateKey: { type: String, required: true },
    templateName: { type: String, required: true },
    kpType: { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
    assets: {
      kpPage1:  { type: String, required: true },
      kpPage2:  { type: String },
      passport: { type: String },
      appendix: { type: String },
    },
    texts: {
      headerNote:  { type: String, default: '' },
      introText:   { type: String, default: '' },
      footerText:  { type: String, default: '' },
      closingText: { type: String, default: '' },
    },
    requisitesSnapshot: {
      inn:   { type: String, match: [INN_REGEX, 'ИНН должен содержать 10 или 12 цифр'] },
      kpp:   String,
      ogrn:  String,
      bik:   { type: String, match: [BIK_REGEX, 'БИК должен содержать 9 цифр'] },
      checkingAccount: { type: String, match: [ACCOUNT_REGEX, 'Расчетный счет должен содержать 20 цифр'] },
      correspondentAccount: { type: String, match: [ACCOUNT_REGEX, 'Корреспондентский счет должен содержать 20 цифр'] },
      phone: String,
      email: String,
    },
  }
}, { _id: false });

const KpSchema = new Schema<IKp>({
  title:  { type: String, required: true },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
  kpType: { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
  counterpartyId: { type: String },
  companyId:      { type: String },
  recipient: {
    name:                  { type: String, default: '' },
    shortName:             String,
    legalForm:             String,
    inn:                   { type: String, match: [INN_REGEX, 'ИНН должен содержать 10 или 12 цифр'] },
    kpp:                   String,
    ogrn:                  String,
    legalAddress:          String,
    phone:                 String,
    email:                 String,
    bankName:              String,
    bik:                   { type: String, match: [BIK_REGEX, 'БИК должен содержать 9 цифр'] },
    checkingAccount:       { type: String, match: [ACCOUNT_REGEX, 'Расчетный счет должен содержать 20 цифр'] },
    correspondentAccount:  { type: String, match: [ACCOUNT_REGEX, 'Корреспондентский счет должен содержать 20 цифр'] },
    founderName:           String,
    founderNameShort:      String,
  },
  metadata: {
    number:            { type: String, required: true },
    validityDays:      { type: Number, default: 10 },
    prepaymentPercent: { type: Number, default: 50 },
    productionDays:    { type: Number, default: 15 },
    tablePageBreakAfter: { type: Number, default: 6, min: [1, 'tablePageBreakAfter должен быть >= 1'] },
    tablePageBreakFirstPage: { type: Number, default: 4, min: [1, 'tablePageBreakFirstPage должен быть >= 1'] },
    tablePageBreakNextPages: { type: Number, default: 6, min: [1, 'tablePageBreakNextPages должен быть >= 1'] },
    photoScalePercent: { type: Number, default: 600, min: [0, 'photoScalePercent должен быть >= 0'], max: [1000, 'photoScalePercent должен быть <= 1000'] },
    photoCropPercent: { type: Number, default: 0, min: [0, 'photoCropPercent должен быть >= 0'], max: [50, 'photoCropPercent должен быть <= 50'] },
    showPhotoColumn: { type: Boolean, default: true },
    defaultMarkupPercent: { type: Number, default: 0, min: [0, 'defaultMarkupPercent должен быть >= 0'], max: [500, 'defaultMarkupPercent должен быть <= 500'] },
    defaultDiscountPercent: { type: Number, default: 0, min: [0, 'defaultDiscountPercent должен быть >= 0'], max: [100, 'defaultDiscountPercent должен быть <= 100'] },
  },
  items:      { type: [KpItemSchema], default: [] },
  conditions: { type: [String], default: [] },
  vatPercent: { type: Number, default: 20 },
  versions: { type: [KpVersionSchema], default: [] },
  companySnapshot: {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Counterparty',
      required: true
    },
    companyName: { type: String, required: true },
    templateKey: { type: String, required: true },
    templateName: { type: String, required: true },
    kpType: { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
    assets: {
      kpPage1:  { type: String, required: true },
      kpPage2:  { type: String },
      passport: { type: String },
      appendix: { type: String },
    },
    texts: {
      headerNote:  { type: String, default: '' },
      introText:   { type: String, default: '' },
      footerText:  { type: String, default: '' },
      closingText: { type: String, default: '' },
    },
    requisitesSnapshot: {
      inn:   { type: String, match: [INN_REGEX, 'ИНН должен содержать 10 или 12 цифр'] },
      kpp:   String,
      ogrn:  String,
      bik:   { type: String, match: [BIK_REGEX, 'БИК должен содержать 9 цифр'] },
      checkingAccount: { type: String, match: [ACCOUNT_REGEX, 'Расчетный счет должен содержать 20 цифр'] },
      correspondentAccount: { type: String, match: [ACCOUNT_REGEX, 'Корреспондентский счет должен содержать 20 цифр'] },
      phone: String,
      email: String,
    },
  }
}, { timestamps: true });

export const Kp = model<IKp>('Kp', KpSchema);

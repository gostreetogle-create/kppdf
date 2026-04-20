import { Schema, model, Document } from 'mongoose';

export type KpStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface IKpItem {
  productId:   string;
  code?:       string;
  name:        string;
  description: string;
  unit:        string;
  price:       number;
  qty:         number;
  imageUrl?:   string;
}

export interface IKp extends Document {
  title: string;
  status: KpStatus;
  counterpartyId?: string;   // ссылка на Counterparty (опционально — можно заполнить вручную)
  recipient: {
    name:                  string;
    shortName?:            string;
    legalForm?:            string;
    inn?:                  string;
    kpp?:                  string;
    ogrn?:                 string;
    legalAddress?:         string;
    phone?:                string;
    email?:                string;
    bankName?:             string;
    bik?:                  string;
    checkingAccount?:      string;
    correspondentAccount?: string;
    founderName?:          string;
    founderNameShort?:     string;
  };
  metadata: {
    number: string;
    validityDays: number;
    prepaymentPercent: number;
    productionDays: number;
  };
  items: IKpItem[];
  conditions: string[];
  vatPercent: number;
}

const KpItemSchema = new Schema<IKpItem>({
  productId:   { type: String, required: true },
  code:        { type: String },
  name:        { type: String, required: true },
  description: { type: String, default: '' },
  unit:        { type: String, required: true },
  price:       { type: Number, required: true },
  qty:         { type: Number, required: true, default: 1, min: [1, 'qty должен быть >= 1'] },
  imageUrl:    { type: String, default: '' },
}, { _id: false });

const KpSchema = new Schema<IKp>({
  title:  { type: String, required: true },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
  counterpartyId: { type: String },
  recipient: {
    name:                  { type: String, default: '' },
    shortName:             String,
    legalForm:             String,
    inn:                   String,
    kpp:                   String,
    ogrn:                  String,
    legalAddress:          String,
    phone:                 String,
    email:                 String,
    bankName:              String,
    bik:                   String,
    checkingAccount:       String,
    correspondentAccount:  String,
    founderName:           String,
    founderNameShort:      String,
  },
  metadata: {
    number:            { type: String, required: true },
    validityDays:      { type: Number, default: 10 },
    prepaymentPercent: { type: Number, default: 50 },
    productionDays:    { type: Number, default: 15 },
  },
  items:      { type: [KpItemSchema], default: [] },
  conditions: { type: [String], default: [] },
  vatPercent: { type: Number, default: 20 },
}, { timestamps: true });

export const Kp = model<IKp>('Kp', KpSchema);

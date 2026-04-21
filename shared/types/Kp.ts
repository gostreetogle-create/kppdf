export type KpStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface KpItem {
  productId:   string;
  code?:       string;
  name:        string;
  description: string;
  unit:        string;
  price:       number;
  qty:         number;
  imageUrl?:   string;
}

export interface KpRecipient {
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
}

export interface KpMetadata {
  number:            string;
  createdAt?:        Date;
  validityDays:      number;
  prepaymentPercent: number;
  productionDays:    number;
}

export interface IKp {
  _id:             string;
  title:           string;
  status:          KpStatus;
  counterpartyId?: string;
  companyId?:      string;
  recipient:       KpRecipient;
  metadata:        KpMetadata;
  items:           KpItem[];
  conditions:      string[];
  vatPercent:      number;
  createdAt?:      string;
  updatedAt?:      string;
}

/** Alias для совместимости с frontend (без префикса I) */
export type Kp = IKp;

// Бизнес-правила статусов (см. docs/business-rules.md)
export const KP_STATUS_TRANSITIONS: Record<KpStatus, KpStatus[]> = {
  draft:    ['sent'],
  sent:     ['accepted', 'rejected'],
  accepted: [],
  rejected: ['draft'],
};

export const KP_STATUS_LABELS: Record<KpStatus, string> = {
  draft:    'Черновик',
  sent:     'Отправлен',
  accepted: 'Принят',
  rejected: 'Отклонён',
};

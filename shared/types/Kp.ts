export type KpStatus = 'draft' | 'sent' | 'accepted' | 'rejected';
export type KpType = 'standard' | 'response' | 'special' | 'tender' | 'service';

export interface KpItem {
  productId:   string;
  code?:       string;
  name:        string;
  description: string;
  unit:        string;
  price:       number;
  qty:         number;
  imageUrl?:   string;
  markupEnabled?: boolean;
  markupPercent?: number;
  discountEnabled?: boolean;
  discountPercent?: number;
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
  tablePageBreakAfter?: number;
  tablePageBreakFirstPage?: number;
  tablePageBreakNextPages?: number;
  photoScalePercent?: number;
  showPhotoColumn?: boolean;
  defaultMarkupPercent?: number;
  defaultDiscountPercent?: number;
}

export interface IKp {
  _id:             string;
  title:           string;
  status:          KpStatus;
  kpType:          KpType;
  counterpartyId?: string;
  companyId?:      string;
  recipient:       KpRecipient;
  metadata:        KpMetadata;
  companySnapshot: {
    companyId: string;
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
      phone?: string;
      email?: string;
    };
  };
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

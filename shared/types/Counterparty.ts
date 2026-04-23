import { ImageContext } from './Product';

export type LegalForm  = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'МКУ' | 'Физлицо' | 'Другое';
export type CpRole     = 'client' | 'supplier' | 'company';
export type CpStatus   = 'active' | 'inactive';
export type KpType = 'standard' | 'response' | 'special' | 'tender' | 'service';

export interface CpContact {
  name:      string;
  position?: string;
  phone?:    string;
  email?:    string;
}

export interface CpImage {
  url:       string;
  isMain:    boolean;
  sortOrder: number;
  context?:  ImageContext;
}

export interface ICounterparty {
  _id:                   string;
  legalForm:             LegalForm;
  role:                  CpRole[];
  name:                  string;
  shortName:             string;
  inn:                   string;
  kpp?:                  string;
  ogrn?:                 string;
  legalAddress?:         string;
  actualAddress?:        string;
  sameAddress:           boolean;
  phone?:                string;
  email?:                string;
  website?:              string;
  contacts:              CpContact[];
  bankName?:             string;
  bik?:                  string;
  checkingAccount?:      string;
  correspondentAccount?: string;
  founderName?:          string;
  founderNameShort?:     string;
  status:                CpStatus;
  notes?:                string;
  tags:                  string[];
  // Company profile
  isOurCompany?:         boolean;
  images?:               CpImage[];
  footerText?:           string;
  defaultMarkupPercent?: number;
  defaultDiscountPercent?: number;
  brandingTemplates?: Array<{
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
    texts: {
      headerNote?: string;
      introText?: string;
      footerText?: string;
      closingText?: string;
    };
  }>;
  createdAt?:            string;
  updatedAt?:            string;
}

/** Alias для совместимости с frontend */
export type Counterparty = ICounterparty;

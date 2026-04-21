import { ImageContext } from './Product';

export type LegalForm  = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'Физлицо' | 'Другое';
export type CpRole     = 'client' | 'supplier';
export type CpStatus   = 'active' | 'inactive';

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
  createdAt?:            string;
  updatedAt?:            string;
}

/** Alias для совместимости с frontend */
export type Counterparty = ICounterparty;

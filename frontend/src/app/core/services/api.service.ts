import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

export type ProductKind   = 'ITEM' | 'SERVICE' | 'WORK';
export type ImageContext  = 'product' | 'kp-page1' | 'kp-page2' | 'passport';

export interface ProductImage {
  url:       string;
  isMain:    boolean;
  sortOrder: number;
  context?:  ImageContext;  // optional — backward compatible, defaults to 'product'
}

/** Factory — единственный правильный способ создавать ProductImage */
export function createImage(
  url: string,
  options: { isMain?: boolean; sortOrder?: number; context?: ImageContext } = {}
): ProductImage {
  return {
    url,
    isMain:    options.isMain    ?? false,
    sortOrder: options.sortOrder ?? 0,
    context:   options.context   ?? 'product',
  };
}

export interface Product {
  _id:          string;
  code:         string;
  name:         string;
  description:  string;
  category:     string;
  subcategory?: string;
  unit:         string;
  price:        number;
  costRub?:     number;
  images:       ProductImage[];
  isActive:     boolean;
  kind:         ProductKind;
  notes?:       string;
}

export interface Setting {
  _id:   string;
  key:   string;
  value: unknown;
  label: string;
}

export interface SettingsMap {
  kp_validity_days?:      number;
  kp_prepayment_percent?: number;
  kp_production_days?:    number;
  kp_vat_percent?:        number;
  [key: string]:          unknown;
}

export interface BackupItem {
  filename: string;
  type: 'mongo' | 'media';
  sizeBytes: number;
  createdAt: string;
}

export type DictionaryType = 'category' | 'subcategory' | 'unit' | 'kind';

export interface Dictionary {
  _id:       string;
  type:      DictionaryType;
  value:     string;
  sortOrder: number;
  isActive:  boolean;
}

export type LegalForm = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'Физлицо' | 'Другое';
export type CpRole    = 'client' | 'supplier' | 'company';

export interface CpContact {
  name:      string;
  position?: string;
  phone?:    string;
  email?:    string;
}

export interface Counterparty {
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
  status:                'active' | 'inactive';
  notes?:                string;
  tags:                  string[];
  // Company profile (isOurCompany=true)
  isOurCompany?:         boolean;
  images?:               ProductImage[];
  footerText?:           string;
  createdAt:             string;
  updatedAt:             string;
}

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

export interface Kp {
  _id: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  counterpartyId?: string;
  companyId?:      string;
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
    createdAt?: Date;
    validityDays: number;
    prepaymentPercent: number;
    productionDays: number;
    tablePageBreakAfter: number;
  };
  items: KpItem[];
  conditions: string[];
  vatPercent: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // shareReplay(1) — кэшируем список, не дёргаем сервер повторно
  private products$!: Observable<Product[]>;

  constructor(private http: HttpClient) {
    this.products$ = this.http.get<Product[]>(`${BASE}/products`).pipe(shareReplay(1));
  }

  getProducts(params?: { category?: string; kind?: string; isActive?: boolean; q?: string }): Observable<Product[]> {
    return this.products$;
  }

  getProductCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${BASE}/products/categories`);
  }

  createProduct(data: Omit<Product, '_id'>): Observable<Product> {
    return this.http.post<Product>(`${BASE}/products`, data).pipe(
      tap(() => this.invalidateProducts())
    );
  }

  updateProduct(id: string, data: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${BASE}/products/${id}`, data).pipe(
      tap(() => this.invalidateProducts())
    );
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/products/${id}`).pipe(
      tap(() => this.invalidateProducts())
    );
  }

  bulkImportProducts(
    items: any[],
    mode: 'skip' | 'update' = 'skip'
  ): Observable<{ created: number; updated: number; skipped: number; errors: string[] }> {
    return this.http
      .post<{ created: number; updated: number; skipped: number; errors: string[] }>(
        `${BASE}/products/bulk`,
        { items, mode }
      )
      .pipe(tap(() => this.invalidateProducts()));
  }

  // Сбрасываем кэш — следующий getProducts() сделает новый запрос
  private invalidateProducts() {
    this.products$ = this.http.get<Product[]>(`${BASE}/products`).pipe(shareReplay(1));
  }

  // ─── KP ───────────────────────────────────────────────
  getKpList(): Observable<Kp[]> {
    return this.http.get<Kp[]>(`${BASE}/kp`);
  }

  getKp(id: string): Observable<Kp> {
    return this.http.get<Kp>(`${BASE}/kp/${id}`);
  }

  createKp(data: Partial<Kp>): Observable<Kp> {
    return this.http.post<Kp>(`${BASE}/kp`, data);
  }

  updateKp(id: string, data: Partial<Kp>): Observable<Kp> {
    return this.http.put<Kp>(`${BASE}/kp/${id}`, data);
  }

  deleteKp(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/kp/${id}`);
  }

  duplicateKp(id: string): Observable<Kp> {
    return this.http.post<Kp>(`${BASE}/kp/${id}/duplicate`, {});
  }

  // ─── Dictionaries ─────────────────────────────────────
  getDictionaries(type?: DictionaryType): Observable<Dictionary[]> {
    const params: Record<string, string> = {};
    if (type) params['type'] = type;
    return this.http.get<Dictionary[]>(`${BASE}/dictionaries`, { params });
  }

  createDictionaryItem(data: Omit<Dictionary, '_id'>): Observable<Dictionary> {
    return this.http.post<Dictionary>(`${BASE}/dictionaries`, data);
  }

  updateDictionaryItem(id: string, data: Partial<Dictionary>): Observable<Dictionary> {
    return this.http.put<Dictionary>(`${BASE}/dictionaries/${id}`, data);
  }

  deleteDictionaryItem(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/dictionaries/${id}`);
  }
  // ─── Settings ─────────────────────────────────────────
  getSettings(): Observable<{ list: Setting[]; map: SettingsMap }> {
    return this.http.get<{ list: Setting[]; map: SettingsMap }>(`${BASE}/settings`);
  }
  updateSetting(key: string, value: unknown): Observable<Setting> {
    return this.http.put<Setting>(`${BASE}/settings/${key}`, { value });
  }
  updateSettings(updates: SettingsMap): Observable<{ list: Setting[]; map: SettingsMap }> {
    return this.http.put<{ list: Setting[]; map: SettingsMap }>(`${BASE}/settings`, updates);
  }

  getBackups(): Observable<{ items: BackupItem[] }> {
    return this.http.get<{ items: BackupItem[] }>(`${BASE}/settings/backups`);
  }

  runBackupNow(): Observable<{ message: string; files: { mongo: string; media: string } }> {
    return this.http.post<{ message: string; files: { mongo: string; media: string } }>(`${BASE}/settings/backups/run`, {});
  }

  deleteBackup(type: 'mongo' | 'media', filename: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/settings/backups/${type}/${encodeURIComponent(filename)}`);
  }

  cleanupBackups(days: number, type: 'all' | 'mongo' | 'media' = 'all'): Observable<{
    message: string;
    deleted: { mongo: number; media: number; total: number };
  }> {
    return this.http.delete<{
      message: string;
      deleted: { mongo: number; media: number; total: number };
    }>(`${BASE}/settings/backups/cleanup`, { params: { days, type } as any });
  }

  downloadBackup(type: 'mongo' | 'media', filename: string): Observable<Blob> {
    return this.http.get(`${BASE}/settings/backups/download/${type}/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
  }

  // ─── Counterparties ───────────────────────────────────
  getOurCompany(): Observable<Counterparty> {
    return this.http.get<Counterparty>(`${BASE}/counterparties/company`);
  }

  getCounterparties(params?: { role?: CpRole; status?: string; q?: string }): Observable<Counterparty[]> {
    return this.http.get<Counterparty[]>(`${BASE}/counterparties`, { params: params as any });
  }

  lookupCounterpartyByInn(inn: string): Observable<Partial<Counterparty>> {
    return this.http.get<Partial<Counterparty>>(`${BASE}/counterparties/lookup`, { params: { inn } });
  }

  getCounterparty(id: string): Observable<Counterparty> {
    return this.http.get<Counterparty>(`${BASE}/counterparties/${id}`);
  }

  createCounterparty(data: Omit<Counterparty, '_id' | 'createdAt' | 'updatedAt'>): Observable<Counterparty> {
    return this.http.post<Counterparty>(`${BASE}/counterparties`, data);
  }

  updateCounterparty(id: string, data: Partial<Counterparty>): Observable<Counterparty> {
    return this.http.put<Counterparty>(`${BASE}/counterparties/${id}`, data);
  }

  deleteCounterparty(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/counterparties/${id}`);
  }

  bulkImportCounterparties(
    items: any[],
    mode: 'skip' | 'update' = 'skip'
  ): Observable<{ created: number; updated: number; skipped: number; errors: string[] }> {
    return this.http
      .post<{ created: number; updated: number; skipped: number; errors: string[] }>(
        `${BASE}/counterparties/bulk`,
        { items, mode }
      );
  }
}

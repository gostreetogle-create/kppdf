import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

export type ProductKind   = 'ITEM' | 'SERVICE' | 'WORK';
export type ImageContext  = 'product' | 'kp-page1' | 'kp-page2' | 'passport';
export type KpType = 'standard' | 'response' | 'special' | 'tender' | 'service';

export const KP_TYPE_LABELS: Record<KpType, string> = {
  standard: 'КП',
  response: 'Ответ на письмо',
  special: 'Спецпредложение',
  tender: 'Для тендера',
  service: 'На услуги',
};

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
  specId?:      string;
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

export interface ProductSpecParam {
  name: string;
  value: string;
}

export interface ProductSpecGroup {
  title: string;
  params: ProductSpecParam[];
}

export interface ProductSpecDrawings {
  viewFront?: string;
  viewSide?: string;
  viewTop?: string;
  view3D?: string;
}

export interface ProductSpec {
  _id: string;
  productId: string;
  drawings: ProductSpecDrawings;
  groups: ProductSpecGroup[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSpecTemplate {
  key: string;
  name: string;
  groups: ProductSpecGroup[];
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

export interface AppUser {
  _id: string;
  username: string;
  name: string;
  roleId: string | null;
  roleKey: string;
  roleName: string;
  permissions?: string[];
  isSystemRole?: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
}

export interface Role {
  _id: string;
  name: string;
  key: string;
  isSystem: boolean;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type PermissionModule = 'kp' | 'products' | 'counterparties' | 'users' | 'settings' | 'backups';

export interface PermissionDefinition {
  key: string;
  label: string;
  module: PermissionModule;
  description: string;
}

export type DictionaryType = 'category' | 'subcategory' | 'unit' | 'kind';

export interface Dictionary {
  _id:       string;
  type:      DictionaryType;
  value:     string;
  sortOrder: number;
  isActive:  boolean;
}

export type LegalForm = 'ООО' | 'ИП' | 'АО' | 'ПАО' | 'МКУ' | 'Физлицо' | 'Другое';
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
  isDefaultInitiator?:   boolean;
  images?:               ProductImage[];
  footerText?:           string;
  defaultMarkupPercent?: number;
  defaultDiscountPercent?: number;
  brandingTemplates?:    BrandingTemplate[];
  createdAt:             string;
  updatedAt:             string;
}

export interface BrandingTemplate {
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
}

export interface BrandingTemplatesDto {
  kpTypes: Array<{ value: KpType; label: string }>;
  templatesByType: Partial<Record<KpType, Array<{ key: string; name: string; isDefault: boolean }>>>;
  defaultByType: Partial<Record<KpType, string>>;
}

export interface UpdateBrandingTemplatesResponse {
  message: string;
  brandingTemplates: BrandingTemplate[];
}

export interface SwitchKpTypeResponse {
  kp: Kp;
  meta: {
    conditionsReplaced: boolean;
    previousKpType: KpType;
    nextKpType: KpType;
  };
}

export interface GuestPreviewIssueResponse {
  previewUrl: string;
  expiresInSeconds: number;
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
  markupEnabled?: boolean;
  markupPercent?: number;
  discountEnabled?: boolean;
  discountPercent?: number;
}

export interface Kp {
  _id: string;
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  kpType: KpType;
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
    tablePageBreakAfter?: number;
    tablePageBreakFirstPage?: number;
    tablePageBreakNextPages?: number;
    photoScalePercent?: number;
    photoCropPercent?: number;
    showPhotoColumn?: boolean;
    defaultMarkupPercent?: number;
    defaultDiscountPercent?: number;
  };
  items: KpItem[];
  conditions: string[];
  vatPercent: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateKpPayload {
  title: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  companyId?: string;
  kpType?: KpType;
  templateKey?: string;
  recipient: { name: string };
  items: KpItem[];
  conditions: string[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // shareReplay(1) — кэшируем список, не дёргаем сервер повторно
  private products$!: Observable<Product[]>;

  constructor(private http: HttpClient) {
    this.products$ = this.http.get<Product[]>(`${BASE}/products`).pipe(shareReplay(1));
  }

  getProducts(params?: { category?: string; kind?: string; isActive?: boolean; q?: string; hasSpec?: boolean | null }): Observable<Product[]> {
    if (!params || Object.keys(params).length === 0) {
      return this.products$;
    }
    const normalizedParams: Record<string, string> = {};
    if (params.category) normalizedParams['category'] = params.category;
    if (params.kind) normalizedParams['kind'] = params.kind;
    if (params.q) normalizedParams['q'] = params.q;
    if (typeof params.isActive === 'boolean') normalizedParams['isActive'] = String(params.isActive);
    if (typeof params.hasSpec === 'boolean') normalizedParams['hasSpec'] = String(params.hasSpec);
    return this.http.get<Product[]>(`${BASE}/products`, { params: normalizedParams });
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${BASE}/products/${id}`);
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

  uploadProductImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${BASE}/products/upload-image`, formData);
  }

  getProductSpecByProductId(productId: string): Observable<ProductSpec | null> {
    return this.http.get<ProductSpec>(`${BASE}/product-specs/product/${productId}`).pipe(
      catchError((error: HttpErrorResponse) => error.status === 404 ? of(null) : throwError(() => error))
    );
  }

  getProductSpecTemplates(): Observable<ProductSpecTemplate[]> {
    return this.http.get<ProductSpecTemplate[]>(`${BASE}/product-specs/templates`);
  }

  upsertProductSpec(productId: string, payload: { drawings: ProductSpecDrawings; groups: ProductSpecGroup[] }): Observable<ProductSpec> {
    return this.http.put<ProductSpec>(`${BASE}/product-specs/product/${productId}`, payload).pipe(
      tap(() => this.invalidateProducts())
    );
  }

  uploadProductSpecDrawing(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${BASE}/product-specs/upload`, formData);
  }

  exportProductPassportPdf(productId: string): Observable<Blob> {
    return this.http.get(`${BASE}/kp/passport/${productId}/export`, { responseType: 'blob' });
  }

  getProductPassportPdfPreviewUrl(productId: string): string {
    return `${BASE}/kp/passport/${productId}/preview`;
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

  createKp(data: CreateKpPayload): Observable<Kp> {
    return this.http.post<Kp>(`${BASE}/kp`, data);
  }

  updateKp(id: string, data: Partial<Kp>): Observable<Kp> {
    return this.http.put<Kp>(`${BASE}/kp/${id}`, data);
  }

  switchKpType(id: string, payload: { kpType: KpType; companyId?: string; templateKey?: string; overwriteConditions?: boolean }): Observable<SwitchKpTypeResponse> {
    return this.http.put<SwitchKpTypeResponse>(`${BASE}/kp/${id}/switch-type`, payload);
  }

  deleteKp(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/kp/${id}`);
  }

  duplicateKp(id: string): Observable<Kp> {
    return this.http.post<Kp>(`${BASE}/kp/${id}/duplicate`, {});
  }

  exportKpPdf(id: string): Observable<Blob> {
    return this.http.get(`${BASE}/kp/${id}/export`, { responseType: 'blob' });
  }

  exportToPdf(id: string): Observable<Blob> {
    return this.http.get(`${BASE}/kp/${id}/export`, {
      responseType: 'blob'
    });
  }

  getKpPdfPreviewUrl(id: string): string {
    return `${BASE}/kp/${id}/preview`;
  }

  issueGuestPreviewLink(ttlDays = 7): Observable<GuestPreviewIssueResponse> {
    return this.http.post<GuestPreviewIssueResponse>(`${BASE}/guest/issue`, { ttlDays });
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

  // ─── Users ─────────────────────────────────────────────
  getUsers(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${BASE}/users`);
  }

  createUser(data: { username: string; name: string; roleId: string; password: string }): Observable<AppUser> {
    return this.http.post<AppUser>(`${BASE}/users`, data);
  }

  updateUser(id: string, data: Partial<Pick<AppUser, 'username' | 'name' | 'roleId' | 'isActive' | 'mustChangePassword'>>): Observable<AppUser> {
    return this.http.patch<AppUser>(`${BASE}/users/${id}`, data);
  }

  resetUserPassword(id: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${BASE}/users/${id}/reset-password`, { password });
  }

  deleteUser(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${BASE}/users/${id}`);
  }

  // ─── Roles & Permissions ───────────────────────────────
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${BASE}/roles`);
  }

  getPermissions(): Observable<PermissionDefinition[]> {
    return this.http.get<PermissionDefinition[]>(`${BASE}/permissions`);
  }

  createRole(data: { name: string; copyFromRoleId?: string }): Observable<Role> {
    return this.http.post<Role>(`${BASE}/roles`, data);
  }

  updateRoleName(roleId: string, name: string): Observable<Role> {
    return this.http.put<Role>(`${BASE}/roles/${roleId}/name`, { name });
  }

  updateRolePermissions(roleId: string, permissions: string[]): Observable<Role> {
    return this.http.put<Role>(`${BASE}/roles/${roleId}/permissions`, { permissions });
  }

  deleteRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/roles/${roleId}`);
  }

  // ─── Counterparties ───────────────────────────────────
  getOurCompany(): Observable<Counterparty> {
    return this.http.get<Counterparty>(`${BASE}/counterparties/company`);
  }

  getCounterparties(params?: { role?: CpRole; status?: string; q?: string; isOurCompany?: boolean }): Observable<Counterparty[]> {
    return this.http.get<Counterparty[]>(`${BASE}/counterparties`, { params: params as any });
  }

  lookupCounterpartyByInn(inn: string): Observable<Partial<Counterparty>> {
    return this.http.get<Partial<Counterparty>>(`${BASE}/counterparties/lookup`, { params: { inn } });
  }

  getCounterparty(id: string): Observable<Counterparty> {
    return this.http.get<Counterparty>(`${BASE}/counterparties/${id}`);
  }

  uploadBrandingImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${BASE}/counterparties/upload-branding-image`, formData);
  }

  getBrandingTemplates(companyId: string): Observable<BrandingTemplatesDto> {
    return this.http.get<BrandingTemplatesDto>(`${BASE}/counterparties/${companyId}/branding-templates`);
  }

  updateBrandingTemplates(companyId: string, brandingTemplates: BrandingTemplate[]): Observable<UpdateBrandingTemplatesResponse> {
    return this.http.put<UpdateBrandingTemplatesResponse>(`${BASE}/counterparties/${companyId}/branding-templates`, {
      brandingTemplates
    });
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

import { ChangeDetectionStrategy, Component, OnInit, signal, computed, inject, DestroyRef, effect, HostListener } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, Observable, Subject, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ApiService, Kp, Product, KpItem, Counterparty, KpType, KP_TYPE_LABELS, BrandingTemplatesDto } from '../../../core/services/api.service';
import { KpDocumentComponent } from '../components/kp-document/kp-document.component';
import { KpCatalogItemComponent } from '../components/kp-catalog-item/kp-catalog-item.component';
import { type KpCatalogItem, type PriceChangedEvent } from '../components/kp-catalog/kp-catalog.component';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent } from '../../../shared/ui/index';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { CounterpartyFormComponent } from '../../../shared/components/counterparty-form/counterparty-form.component';
import { ProductFormComponent } from '../../products/components/product-form/product-form.component';
import { AutosaveService } from './autosave.service';
import { KpBuilderStore } from './kp-builder.store';
import { KpTemplateService } from './kp-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionsService } from '../../../core/services/permissions.service';
import { ModalService } from '../../../core/services/modal.service';

@Component({
  selector: 'app-kp-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, KpDocumentComponent, KpCatalogItemComponent, ButtonComponent, ModalComponent, StatusBadgeComponent, CounterpartyFormComponent, ProductFormComponent],
  providers: [AutosaveService, KpBuilderStore, KpTemplateService],   // scope — только этот компонент
  templateUrl: './kp-builder.component.html',
  styleUrls: [
    './kp-builder.component.scss',
    './kp-builder.layout.scss',
    './kp-builder.sidebar.scss',
    './kp-builder.widgets.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpBuilderComponent implements OnInit {
  private static readonly PHOTO_SCALE_BASE = 600;
  private static readonly PHOTO_SCALE_UI_MAX = 400;

  private readonly destroyRef  = inject(DestroyRef);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly api         = inject(ApiService);
  private readonly store       = inject(KpBuilderStore);
  private readonly permissions = inject(PermissionsService);
  private readonly modal       = inject(ModalService);
  private readonly ns          = inject(NotificationService);
  readonly autosave            = inject(AutosaveService);

  readonly kp    = this.store.kp;
  products       = signal<Product[]>([]);
  counterparties = signal<Counterparty[]>([]);
  ourCompanies = signal<Counterparty[]>([]);
  loading        = signal(true);
  conditionDraft = '';
  selectedItemIds = signal<string[]>([]);
  bulkMarkupPercent = signal(0);
  bulkDiscountPercent = signal(0);
  brandingTemplatesDto = signal<BrandingTemplatesDto | null>(null);
  selectedCompanyId = signal<string | null>(null);
  selectedKpType = signal<KpType>('standard');
  selectedTemplateKey = signal<string>('auto');
  switchingType = signal(false);
  focusCatalog = signal(false);
  catalogSearch = signal('');
  catalogCategory = signal('');
  recipientCollapsed = signal(true);
  catalogCollapsed = signal(true);
  paramsCollapsed = signal(true);
  itemsCollapsed = signal(true);
  conditionsCollapsed = signal(true);
  /** Модалка создания контрагента без ухода со страницы КП */
  recipientFormOpen = signal(false);
  /** Модалка создания товара прямо из КП */
  productFormOpen = signal(false);
  /** Подтверждение ухода со страницы (ui-modal, не window.confirm) */
  showLeaveConfirm = signal(false);
  showRestoreBackup = signal(false);
  lastRemovedItem = signal<KpItem | null>(null);
  isExporting = signal(false);
  isPdfMenuOpen = signal(false);

  // ─── computed ─────────────────────────────────────────
  readonly catalogItems = computed<KpCatalogItem[]>(() =>
    (this.kp()?.items ?? []).map(i => ({
      id:          i.productId,
      code:        i.code,
      name:        i.name,
      description: i.description,
      unit:        i.unit,
      price:       this.itemUnitPrice(i),
      basePrice:   i.price,
      adjustmentsLabel: this.itemAdjustmentsLabel(i),
      qty:         i.qty,
      imageUrl:    this.normalizeImageUrl(i.imageUrl)
    }))
  );

  readonly subtotal = computed(() =>
    this.kp()?.items.reduce((s, i) => s + this.itemUnitPrice(i) * i.qty, 0) ?? 0
  );
  readonly vatAmount = computed(() =>
    Math.round(this.subtotal() * (this.kp()?.vatPercent ?? 20) / 100)
  );
  readonly total = computed(() => this.subtotal() + this.vatAmount());
  readonly categories = computed(() =>
    Array.from(new Set(this.products().map(p => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  );
  readonly kpTypeOptions = computed(() =>
    Object.entries(KP_TYPE_LABELS).map(([value, label]) => ({ value: value as KpType, label }))
  );
  readonly templatesForSelectedType = computed(() => {
    const dto = this.brandingTemplatesDto();
    if (!dto) return [];
    return dto.templatesByType[this.selectedKpType()] ?? [];
  });
  readonly showBrandingTemplateSelect = computed(() => this.templatesForSelectedType().length > 1);
  readonly companyOptions = computed(() => this.ourCompanies());
  readonly filteredProducts = computed(() => {
    const q = this.catalogSearch().trim().toLowerCase();
    const cat = this.catalogCategory();
    return this.products().filter(product => {
      const inCategory = !cat || product.category === cat;
      const inSearch = !q
        || product.name.toLowerCase().includes(q)
        || product.code.toLowerCase().includes(q)
        || product.description.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
  });
  readonly can = (permission: Parameters<PermissionsService['can']>[0]) => this.permissions.can(permission);
  readonly isReadOnly = computed(() => {
    const status = this.kp()?.status;
    return status === 'sent' || status === 'accepted';
  });
  readonly isDraft = computed(() => this.kp()?.status === 'draft');
  readonly previewPageCount = computed(() => {
    const kp = this.kp();
    if (!kp) return 1;
    const first = Math.max(1, Number(kp.metadata?.tablePageBreakFirstPage ?? kp.metadata?.tablePageBreakAfter) || 6);
    const next = Math.max(1, Number(kp.metadata?.tablePageBreakNextPages ?? kp.metadata?.tablePageBreakAfter) || 6);
    const total = kp.items.length;
    if (total <= first) return 1;
    return 1 + Math.ceil((total - first) / next);
  });

  /** Есть ли несохранённые изменения — используется в CanDeactivate guard */
  readonly isDirty = computed(() => this.autosave.status() === 'unsaved');

  /** Флаг: данные уже загружены (чтобы effect не триггерил autosave при первой загрузке) */
  private initialized = false;
  /** Первый проход effect после init пропускаем как baseline */
  private autosavePrimed = false;
  /** Автосохранение включаем только после первой позиции товара */
  private autosaveEnabled = false;
  private leaveChoice?: Subject<boolean>;

  updateKp(patch: Partial<Kp>): void {
    this.store.patchKp(patch);
  }

  updateKpWith(updater: (prev: Kp) => Kp): void {
    const current = this.kp();
    if (!current) return;
    this.store.updateState(updater);
  }

  updateMetadata(patch: Partial<Kp['metadata']>): void {
    this.store.updateMetadata(patch);
  }

  private setKpState(next: Kp, trackHistory = true): void {
    if (!trackHistory) {
      this.store.setKp(next);
      return;
    }
    this.store.updateState(() => next);
  }

  constructor() {
    effect(() => {
      const kp = this.kp();
      if (!kp || !this.initialized) return;
      if (!this.autosavePrimed) {
        this.autosavePrimed = true;
        this.autosaveEnabled = kp.items.length > 0;
        return;
      }
      if (!this.autosaveEnabled) {
        if (kp.items.length === 0) return;
        this.autosaveEnabled = true;
      }
      this.autosave.schedule(kp);
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    const selectCpId = this.route.snapshot.queryParamMap.get('selectCp');

    const counterparties$ = this.api.getCounterparties({ status: 'active' }).pipe(
      map(list => list.filter(c => c.role.includes('client') || c.role.includes('company')))
    );
    const ourCompanies$ = this.api.getCounterparties({ isOurCompany: true, status: 'active' });

    forkJoin({ kp: this.api.getKp(id), counterparties: counterparties$, ourCompanies: ourCompanies$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ kp, counterparties, ourCompanies }) => {
          const normalizedKp = this.normalizePaginationMetadata(kp);
          this.counterparties.set(counterparties);
          this.ourCompanies.set(ourCompanies);
          this.setKpState(normalizedKp, false);
          this.selectAllItems();
          this.hydrateTypeControls(normalizedKp);
          this.applyCompanyDefaultsToBulk(normalizedKp);
          if (normalizedKp.items.length > 0) this.itemsCollapsed.set(false);
          this.showRestoreBackup.set(this.hasBackupForKp(normalizedKp._id));
          this.loading.set(false);
          const initCompanyId = normalizedKp.companyId || normalizedKp.companySnapshot?.companyId || ourCompanies[0]?._id || null;
          this.selectedCompanyId.set(initCompanyId);
          if (initCompanyId) this.loadBrandingTemplates(initCompanyId, normalizedKp);
          Promise.resolve().then(() => {
            if (selectCpId) {
              this.fillFromCounterparty(selectCpId);
              void this.router.navigate([], {
                relativeTo: this.route,
                queryParams: { selectCp: null },
                queryParamsHandling: 'merge',
                replaceUrl: true
              });
            }
            this.initialized = true;
          });
        },
        error: () => {
          this.loading.set(false);
          this.ns.error('КП не найдено или недоступно');
          void this.router.navigate(['/']);
        }
      });

    this.api.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.products.set(p));
  }

  /** Модалка нового контрагента на месте (без смены маршрута) */
  openCreateRecipientForm() {
    if (!this.isDraft()) return;
    this.recipientFormOpen.set(true);
  }

  closeRecipientForm() {
    this.recipientFormOpen.set(false);
  }

  openCreateProductForm() {
    if (this.isReadOnly()) return;
    this.productFormOpen.set(true);
  }

  closeProductForm() {
    this.productFormOpen.set(false);
  }

  onProductFormSaved(product: Product) {
    this.products.update(list =>
      list.some(p => p._id === product._id) ? list.map(p => p._id === product._id ? product : p) : [product, ...list]
    );
    this.addItem(product);
    this.productFormOpen.set(false);
    this.ns.success('Товар создан и добавлен в КП');
  }

  onRecipientFormSaved(cp: Counterparty) {
    this.counterparties.update(list =>
      list.some(c => c._id === cp._id) ? list : [cp, ...list]
    );
    this.applyCounterpartyToKp(cp);
    this.recipientFormOpen.set(false);
    this.ns.success('Получатель создан и выбран');
  }

  /** CanDeactivate: без `window.confirm`, ответ через ui-modal */
  confirmDeactivate(): boolean | Observable<boolean> {
    if (!this.isDirty()) return true;
    this.leaveChoice = new Subject<boolean>();
    this.showLeaveConfirm.set(true);
    return this.leaveChoice.pipe(take(1));
  }

  resolveLeaveConfirm(leave: boolean) {
    this.showLeaveConfirm.set(false);
    const s = this.leaveChoice;
    this.leaveChoice = undefined;
    if (s) {
      s.next(leave);
      s.complete();
    }
  }

  /** Заполнить получателя из справочника контрагентов */
  fillFromCounterparty(id: string) {
    if (!this.isDraft()) return;
    if (!id) return;
    const cp = this.counterparties().find(c => c._id === id);
    if (!cp) return;
    this.applyCounterpartyToKp(cp);
  }

  replaceRecipient(id: string) {
    if (!this.isDraft()) {
      this.ns.warning('Заменять получателя можно только в черновике');
      return;
    }
    if (!id) return;
    const cp = this.counterparties().find(c => c._id === id);
    if (!cp) return;
    this.applyCounterpartyToKp(cp);
    const current = this.kp();
    if (current) this.autosave.saveNow(current);
    this.ns.success('Получатель обновлён');
  }

  private applyCounterpartyToKp(cp: Counterparty) {
    const kp = this.kp();
    if (!kp) return;
    this.setKpState({
      ...kp,
      counterpartyId: cp._id,
      recipient: {
        name:                 cp.name,
        shortName:            cp.shortName,
        legalForm:            cp.legalForm,
        inn:                  cp.inn,
        kpp:                  cp.kpp,
        ogrn:                 cp.ogrn,
        legalAddress:         cp.legalAddress,
        phone:                cp.phone,
        email:                cp.email,
        bankName:             cp.bankName,
        bik:                  cp.bik,
        checkingAccount:      cp.checkingAccount,
        correspondentAccount: cp.correspondentAccount,
        founderName:          cp.founderName,
        founderNameShort:     cp.founderNameShort,
      }
    });
  }

  // ─── Мутации (иммутабельные) ──────────────────────────
  addItem(product: Product) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    const existing = kp.items.find(i => i.productId === product._id);
    const items = existing
      ? kp.items.map(i => i.productId === product._id ? { ...i, qty: i.qty + 1 } : i)
      : [...kp.items, {
          productId:   product._id,
          code:        product.code,
          name:        product.name,
          description: product.description,
          unit:        product.unit,
          price:       product.price,
          qty:         1,
          imageUrl:    this.normalizeImageUrl(product.images.find(i => i.isMain)?.url ?? product.images[0]?.url ?? ''),
          markupEnabled: false,
          markupPercent: 0,
          discountEnabled: false,
          discountPercent: 0
        }];
    this.setKpState({ ...kp, items });
    this.selectedItemIds.update((ids) => (ids.includes(product._id) ? ids : [...ids, product._id]));
    if (items.length > 0) this.itemsCollapsed.set(false);
  }

  removeItem(item: KpItem) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.lastRemovedItem.set(item);
    this.setKpState({ ...kp, items: kp.items.filter(i => i.productId !== item.productId) });
    this.selectedItemIds.update(ids => ids.filter(id => id !== item.productId));
  }

  reorderItems(event: CdkDragDrop<KpItem[]>) {
    if (this.isReadOnly()) return;
    if (event.previousIndex === event.currentIndex) return;
    const kp = this.kp();
    if (!kp) return;
    const items = [...kp.items];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.setKpState({ ...kp, items });
  }

  updateQty(item: KpItem, qty: number) {
    if (this.isReadOnly()) return;
    if (qty < 1) return;
    const kp = this.kp();
    if (!kp) return;
    this.setKpState({ ...kp, items: kp.items.map(i => i.productId === item.productId ? { ...i, qty } : i) });
  }

  incrementQty(item: KpItem) {
    this.updateQty(item, item.qty + 1);
  }

  decrementQty(item: KpItem) {
    this.updateQty(item, Math.max(1, item.qty - 1));
  }

  isItemSelected(item: KpItem): boolean {
    return this.selectedItemIds().includes(item.productId);
  }

  toggleItemSelection(item: KpItem, checked: boolean) {
    if (this.isReadOnly()) return;
    if (checked) {
      this.selectedItemIds.update(ids => (ids.includes(item.productId) ? ids : [...ids, item.productId]));
      // Apply current bulk values immediately for newly selected row.
      this.applyBulkMarkup();
      this.applyBulkDiscount();
      return;
    }
    const kp = this.kp();
    if (!kp) return;

    // Interactive behavior: unselecting a row resets applied bulk adjustments for this row.
    this.setKpState({
      ...kp,
      items: kp.items.map(i =>
        i.productId === item.productId
          ? { ...i, markupEnabled: false, markupPercent: 0, discountEnabled: false, discountPercent: 0 }
          : i
      )
    });
    this.selectedItemIds.update(ids => ids.filter(id => id !== item.productId));
  }

  clearSelection() {
    this.selectedItemIds.set([]);
  }

  private selectedIdsSet(kp: Kp): Set<string> {
    const existingIds = new Set(kp.items.map((item) => item.productId));
    const selectedIds = this.selectedItemIds().filter((id) => existingIds.has(id));
    return new Set(selectedIds);
  }

  onBulkMarkupInput(rawValue: string | number) {
    const percent = this.clampPercent(this.parsePercentInput(rawValue), 0, 500);
    this.bulkMarkupPercent.set(percent);
    this.updateKpWith((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, defaultMarkupPercent: percent }
    }));
    this.applyBulkMarkup();
  }

  onBulkDiscountInput(rawValue: string | number) {
    const percent = this.clampPercent(this.parsePercentInput(rawValue), 0, 100);
    this.bulkDiscountPercent.set(percent);
    this.updateKpWith((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, defaultDiscountPercent: percent }
    }));
    this.applyBulkDiscount();
  }

  selectAllItems() {
    const ids = (this.kp()?.items ?? []).map(i => i.productId);
    this.selectedItemIds.set(ids);
  }

  applyBulkMarkup() {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    const selected = this.selectedIdsSet(kp);
    const percent = this.clampPercent(this.bulkMarkupPercent(), 0, 500);
    this.bulkMarkupPercent.set(percent);
    this.setKpState({
      ...kp,
      items: kp.items.map(i =>
        selected.has(i.productId)
          ? { ...i, markupEnabled: percent > 0, markupPercent: percent }
          : i
      )
    });
  }

  applyBulkDiscount() {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    const selected = this.selectedIdsSet(kp);
    const percent = this.clampPercent(this.bulkDiscountPercent(), 0, 100);
    this.bulkDiscountPercent.set(percent);
    this.setKpState({
      ...kp,
      items: kp.items.map(i =>
        selected.has(i.productId)
          ? { ...i, discountEnabled: percent > 0, discountPercent: percent }
          : i
      )
    });
  }

  clearBulkAdjustments() {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    const selected = this.selectedIdsSet(kp);
    this.setKpState({
      ...kp,
      items: kp.items.map(i =>
        selected.has(i.productId)
          ? { ...i, markupEnabled: false, markupPercent: 0, discountEnabled: false, discountPercent: 0 }
          : i
      )
    });
  }

  updateTablePageBreakAfter(value: number) {
    if (this.isReadOnly()) return;
    const normalized = Math.max(1, value || 6);
    this.updateMetadata({
      tablePageBreakAfter: normalized,
      tablePageBreakFirstPage: normalized,
      tablePageBreakNextPages: normalized
    });
  }

  updateTablePageBreakFirstPage(value: number) {
    if (this.isReadOnly()) return;
    this.updateMetadata({ tablePageBreakFirstPage: Math.max(1, value || 6) });
  }

  updateTablePageBreakNextPages(value: number) {
    if (this.isReadOnly()) return;
    this.updateMetadata({ tablePageBreakNextPages: Math.max(1, value || 6) });
  }

  updatePhotoScalePercent(value: number) {
    if (this.isReadOnly()) return;
    const uiValue = this.clampPercent(value, 0, KpBuilderComponent.PHOTO_SCALE_UI_MAX);
    const actualScale = KpBuilderComponent.PHOTO_SCALE_BASE + uiValue;
    this.updateMetadata({ photoScalePercent: this.clampPercent(actualScale, 0, 1000) });
  }

  isPhotoColumnVisible(): boolean {
    return this.kp()?.metadata?.showPhotoColumn !== false;
  }

  togglePhotoColumnVisibility() {
    if (this.isReadOnly()) return;
    this.updateMetadata({ showPhotoColumn: !this.isPhotoColumnVisible() });
  }

  photoScaleUiValue(): number {
    const actual = Number(this.kp()?.metadata?.photoScalePercent ?? KpBuilderComponent.PHOTO_SCALE_BASE);
    return this.clampPercent(actual - KpBuilderComponent.PHOTO_SCALE_BASE, 0, KpBuilderComponent.PHOTO_SCALE_UI_MAX);
  }

  onTitleChange(newTitle: string): void {
    this.updateKp({ title: newTitle });
  }

  onMetadataNumberChange(value: string): void {
    this.updateMetadata({ number: value });
  }

  onValidityDaysChange(value: number): void {
    this.updateMetadata({ validityDays: Math.max(1, value || 1) });
  }

  onPrepaymentPercentChange(value: number): void {
    this.updateMetadata({ prepaymentPercent: this.clampPercent(value, 0, 100) });
  }

  onProductionDaysChange(value: number): void {
    this.updateMetadata({ productionDays: Math.max(1, value || 1) });
  }

  onVatPercentChange(value: number): void {
    this.updateKp({ vatPercent: this.clampPercent(value, 0, 100) });
  }

  onDocumentPriceChanged(event: PriceChangedEvent): void {
    this.store.updateItemPrice(event.itemId, event.newPrice);
  }

  /** Ручное сохранение — немедленно, сбрасывает дебаунс */
  save() {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.autosave.saveNow(kp);
  }

  addCondition() {
    if (this.isReadOnly()) return;
    const value = this.conditionDraft.trim();
    const kp = this.kp();
    if (!kp || !value) return;
    if (kp.conditions.includes(value)) {
      this.conditionDraft = '';
      return;
    }
    this.setKpState({ ...kp, conditions: [...kp.conditions, value] });
    this.conditionDraft = '';
  }

  updateCondition(index: number, value: string) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.setKpState({
      ...kp,
      conditions: kp.conditions.map((item, i) => (i === index ? value : item))
    });
  }

  removeCondition(index: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.setKpState({
      ...kp,
      conditions: kp.conditions.filter((_, i) => i !== index)
    });
  }

  moveConditionUp(index: number) {
    if (this.isReadOnly() || index <= 0) return;
    const kp = this.kp();
    if (!kp) return;
    const conditions = [...kp.conditions];
    [conditions[index - 1], conditions[index]] = [conditions[index], conditions[index - 1]];
    this.setKpState({ ...kp, conditions });
  }

  moveConditionDown(index: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp || index >= kp.conditions.length - 1) return;
    const conditions = [...kp.conditions];
    [conditions[index], conditions[index + 1]] = [conditions[index + 1], conditions[index]];
    this.setKpState({ ...kp, conditions });
  }

  addConditionTemplate(template: string) {
    this.conditionDraft = template;
    this.addCondition();
  }

  undoRemoveItem() {
    if (this.isReadOnly()) return;
    const removed = this.lastRemovedItem();
    const kp = this.kp();
    if (!removed || !kp) return;
    this.setKpState({ ...kp, items: [...kp.items, removed] });
    this.selectedItemIds.update((ids) => (ids.includes(removed.productId) ? ids : [...ids, removed.productId]));
    this.itemsCollapsed.set(false);
    this.lastRemovedItem.set(null);
  }

  toggleSection(section: 'recipient' | 'catalog' | 'params' | 'items' | 'conditions') {
    if (section === 'recipient') this.recipientCollapsed.update(v => !v);
    if (section === 'catalog') this.catalogCollapsed.update(v => !v);
    if (section === 'params') this.paramsCollapsed.update(v => !v);
    if (section === 'items') this.itemsCollapsed.update(v => !v);
    if (section === 'conditions') this.conditionsCollapsed.update(v => !v);
  }

  trackByProductId(_index: number, product: Product): string {
    return product._id;
  }

  isProductInKp(product: Product): boolean {
    return (this.kp()?.items ?? []).some((item) => item.productId === product._id);
  }

  canSelectStatus(targetStatus: Kp['status']): boolean {
    if (this.can('kp.edit') && this.can('kp.delete')) return true;
    const current = this.kp()?.status;
    if (!current) return false;
    if (current === targetStatus) return true;
    return current === 'draft' && targetStatus === 'sent';
  }

  onStatusChange(nextStatus: Kp['status']) {
    const kp = this.kp();
    if (!kp || kp.status === nextStatus) return;
    if (!this.canSelectStatus(nextStatus)) return;

    this.modal.confirm({
      title: 'Смена статуса КП',
      message: `Перевести КП из «${this.statusLabel(kp.status)}» в «${this.statusLabel(nextStatus)}»?`,
      confirmText: 'Подтвердить',
      cancelText: 'Отмена',
      type: 'primary'
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.setKpState({ ...kp, status: nextStatus });
        this.ns.success(`Статус изменён: ${this.statusLabel(nextStatus)}`);
      });
  }

  statusLabel(status: Kp['status']): string {
    const labels: Record<Kp['status'], string> = {
      draft: 'Черновик',
      sent: 'Отправлен',
      accepted: 'Принят',
      rejected: 'Отклонён'
    };
    return labels[status];
  }

  onKpTypeSelectionChange(value: string) {
    this.selectedKpType.set(value as KpType);
    this.selectedTemplateKey.set('auto');
    this.switchKpType();
  }

  onCompanySelectionChange(value: string) {
    const companyId = value || null;
    this.selectedCompanyId.set(companyId);
    this.selectedTemplateKey.set('auto');
    if (companyId) {
      this.loadBrandingTemplates(companyId);
      this.switchKpType();
    } else {
      this.brandingTemplatesDto.set(null);
    }
  }

  onTemplateSelectionChange(value: string) {
    this.selectedTemplateKey.set(value || 'auto');
    this.switchKpType();
  }

  openCompanyBranding() {
    const companyId = this.selectedCompanyId();
    if (!companyId) {
      this.ns.warning('Сначала выберите нашу компанию');
      return;
    }
    void this.router.navigate(['/counterparties'], {
      queryParams: {
        openBranding: '1',
        companyId
      }
    });
  }

  switchKpType() {
    const kp = this.kp();
    if (!kp || this.isReadOnly() || this.switchingType()) return;
    const previous = JSON.parse(JSON.stringify(kp)) as Kp;
    const nextType = this.selectedKpType();
    const templateKey = this.selectedTemplateKey();
    const nextCompanyId = this.selectedCompanyId() || kp.companyId || kp.companySnapshot?.companyId || '';
    if (kp.kpType === nextType && this.isCurrentTemplateSelection()) {
      return;
    }
    this.setKpState({
      ...kp,
      kpType: nextType,
      companyId: nextCompanyId
    });
    this.switchingType.set(true);
    this.api.switchKpType(kp._id, {
      kpType: nextType,
      companyId: this.selectedCompanyId() || undefined,
      templateKey: templateKey === 'auto' ? undefined : templateKey
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ kp: nextKp, meta }) => {
          this.api.getKp(nextKp._id)
            .pipe(take(1), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (fresh) => {
                const normalizedFresh = this.normalizePaginationMetadata(fresh);
                this.setKpState(normalizedFresh, false);
                this.selectAllItems();
                this.hydrateTypeControls(normalizedFresh);
                this.applyCompanyDefaultsToBulk(normalizedFresh);
                this.syncTemplateSelectionByKp(normalizedFresh);
                this.switchingType.set(false);
                this.ns.success(meta.conditionsReplaced
                  ? 'Тип КП изменён, условия обновлены из нового шаблона'
                  : 'Тип КП изменён, пользовательские условия сохранены');
              },
              error: () => {
                // Fallback to switch response if refresh fails.
                const normalizedNext = this.normalizePaginationMetadata(nextKp);
                this.setKpState(normalizedNext, false);
                this.selectAllItems();
                this.hydrateTypeControls(normalizedNext);
                this.applyCompanyDefaultsToBulk(normalizedNext);
                this.syncTemplateSelectionByKp(normalizedNext);
                this.switchingType.set(false);
                this.ns.success('Тип КП изменён');
              }
            });
        },
        error: (err) => {
          this.setKpState(previous, false);
          this.hydrateTypeControls(previous);
          this.applyCompanyDefaultsToBulk(previous);
          this.syncTemplateSelectionByKp(previous);
          this.switchingType.set(false);
          this.ns.error(err?.error?.message || 'Не удалось переключить тип КП');
        }
      });
  }

  normalizeImageUrl(url?: string): string {
    if (!url) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return url;

    let normalized = url.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^\.?\//, '');
    if (normalized.startsWith('media/')) return `/${normalized}`;
    if (normalized.startsWith('products/')) return `/media/${normalized}`;
    if (normalized.startsWith('kp/')) return `/media/${normalized}`;
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  itemUnitPrice(item: KpItem): number {
    const markupPercent = item.markupEnabled ? this.clampPercent(item.markupPercent ?? 0, 0, 500) : 0;
    const discountPercent = item.discountEnabled ? this.clampPercent(item.discountPercent ?? 0, 0, 100) : 0;
    const withMarkup = item.price * (1 + markupPercent / 100);
    const withDiscount = withMarkup * (1 - discountPercent / 100);
    return Math.max(0, Math.round(withDiscount));
  }

  itemAdjustmentsLabel(item: KpItem): string {
    const chunks: string[] = [];
    if (item.markupEnabled && (item.markupPercent ?? 0) > 0) {
      chunks.push(`Наценка +${this.clampPercent(item.markupPercent ?? 0, 0, 500)}%`);
    }
    if (item.discountEnabled && (item.discountPercent ?? 0) > 0) {
      chunks.push(`Скидка -${this.clampPercent(item.discountPercent ?? 0, 0, 100)}%`);
    }
    return chunks.join(' · ');
  }

  itemPriceFormula(item: KpItem): string {
    const base = Math.round(item.price);
    const markup = item.markupEnabled ? this.clampPercent(item.markupPercent ?? 0, 0, 500) : 0;
    const discount = item.discountEnabled ? this.clampPercent(item.discountPercent ?? 0, 0, 100) : 0;
    const finalUnit = this.itemUnitPrice(item);

    if (markup === 0 && discount === 0) {
      return `База ${base.toLocaleString('ru-RU')} ₽`;
    }

    const parts = [`База ${base.toLocaleString('ru-RU')} ₽`];
    if (markup > 0) parts.push(`+${markup}%`);
    if (discount > 0) parts.push(`-${discount}%`);
    parts.push(`= ${finalUnit.toLocaleString('ru-RU')} ₽`);
    return parts.join(' → ');
  }

  private clampPercent(value: number, min: number, max: number): number {
    const n = Number.isFinite(value) ? value : 0;
    return Math.min(max, Math.max(min, n));
  }

  private parsePercentInput(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value?.trim()) return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private hydrateTypeControls(kp: Kp) {
    this.selectedKpType.set((kp.kpType ?? 'standard') as KpType);
    this.selectedCompanyId.set(kp.companyId || kp.companySnapshot?.companyId || null);
  }

  private applyCompanyDefaultsToBulk(kp: Kp) {
    const markup = this.clampPercent(Number(kp.metadata?.defaultMarkupPercent ?? 0) || 0, 0, 500);
    const discount = this.clampPercent(Number(kp.metadata?.defaultDiscountPercent ?? 0) || 0, 0, 100);
    this.bulkMarkupPercent.set(markup);
    this.bulkDiscountPercent.set(discount);
  }

  private syncTemplateSelectionByKp(kp: Kp) {
    const current = kp.companySnapshot?.templateKey;
    const matches = this.templatesForSelectedType().some(template => template.key === current);
    this.selectedTemplateKey.set(matches && current ? current : 'auto');
  }

  private normalizePaginationMetadata(kp: Kp): Kp {
    const fallback = Math.max(1, Number(kp.metadata?.tablePageBreakAfter) || 6);
    return {
      ...kp,
      metadata: {
        ...kp.metadata,
        tablePageBreakAfter: fallback,
        tablePageBreakFirstPage: Math.max(1, Number(kp.metadata?.tablePageBreakFirstPage ?? fallback) || fallback),
        tablePageBreakNextPages: Math.max(1, Number(kp.metadata?.tablePageBreakNextPages ?? fallback) || fallback),
        showPhotoColumn: kp.metadata?.showPhotoColumn !== false,
      }
    };
  }

  private isCurrentTemplateSelection(): boolean {
    const kp = this.kp();
    if (!kp) return false;
    if ((this.selectedCompanyId() || '') !== (kp.companyId || kp.companySnapshot?.companyId || '')) return false;
    if (this.selectedTemplateKey() === 'auto') return true;
    return this.selectedTemplateKey() === (kp.companySnapshot?.templateKey ?? '');
  }

  private loadBrandingTemplates(companyId: string, kp?: Kp) {
    this.api.getBrandingTemplates(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.brandingTemplatesDto.set(dto);
          if (kp) this.syncTemplateSelectionByKp(kp);
        },
        error: () => {
          this.brandingTemplatesDto.set(null);
        }
      });
  }

  readonly conditionTemplates = [
    'Срок поставки: 15 рабочих дней с момента оплаты.',
    'Гарантия на продукцию: 12 месяцев.',
    'Доставка рассчитывается отдельно и не входит в стоимость КП.'
  ];

  onExportHQ() {
    const kp = this.kp();
    if (!kp || this.isExporting()) return;

    this.isExporting.set(true);
    this.ns.info('Генерация PDF высокого качества...');
    this.api.exportToPdf(kp._id).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const docNumber = String(kp.metadata?.number || 'бн').replace(/[^\w.-]+/g, '_');
        const safeFileName = `КП_${docNumber}.pdf`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = safeFileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        this.isExporting.set(false);
        this.ns.success('PDF успешно сгенерирован');
      },
      error: () => {
        this.isExporting.set(false);
        this.ns.error('Ошибка генерации PDF на сервере');
      }
    });
  }

  onQuickPrint() {
    this.isPdfMenuOpen.set(false);
    window.print();
  }

  togglePdfMenu(event: Event) {
    event.stopPropagation();
    this.isPdfMenuOpen.update((value) => !value);
  }

  @HostListener('document:click')
  closePdfMenu() {
    this.isPdfMenuOpen.set(false);
  }

  @HostListener('window:keydown.control.z', ['$event'])
  onUndo(event: any) {
    if (this.loading() || this.isReadOnly()) return;
    event.preventDefault();
    this.store.undo();
  }

  @HostListener('window:keydown.control.y', ['$event'])
  @HostListener('window:keydown.control.shift.z', ['$event'])
  onRedo(event: any) {
    if (this.loading() || this.isReadOnly()) return;
    event.preventDefault();
    this.store.redo();
  }

  restoreUnsavedBackup() {
    const kpId = this.kp()?._id;
    if (!kpId) return;
    const restored = this.store.restoreFromBackup(kpId);
    this.showRestoreBackup.set(false);
    if (restored) {
      this.autosave.status.set('unsaved');
      this.ns.success('Локальная копия восстановлена');
      return;
    }
    this.ns.warning('Локальная копия недоступна');
  }

  dismissBackupRestore() {
    const kpId = this.kp()?._id;
    if (kpId) this.store.clearBackup(kpId);
    this.showRestoreBackup.set(false);
  }

  private hasBackupForKp(kpId: string): boolean {
    try {
      return Boolean(localStorage.getItem(`kp_builder_backup_${kpId}`));
    } catch {
      return false;
    }
  }

  back()  { this.router.navigate(['/']); }
}

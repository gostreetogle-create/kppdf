import { Component, OnInit, signal, computed, inject, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, Observable, Subject, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Kp, Product, KpItem, Counterparty } from '../../../core/services/api.service';
import { KpDocumentComponent } from '../components/kp-document/kp-document.component';
import { type KpCatalogItem } from '../components/kp-catalog/kp-catalog.component';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent } from '../../../shared/ui/index';
import { CounterpartyFormComponent } from '../../../shared/components/counterparty-form/counterparty-form.component';
import { ProductFormComponent } from '../../products/components/product-form/product-form.component';
import { AutosaveService } from './autosave.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionsService } from '../../../core/services/permissions.service';

@Component({
  selector: 'app-kp-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, KpDocumentComponent, ButtonComponent, ModalComponent, CounterpartyFormComponent, ProductFormComponent],
  providers: [AutosaveService],   // scope — только этот компонент
  templateUrl: './kp-builder.component.html',
  styleUrls: [
    './kp-builder.component.scss',
    './kp-builder.layout.scss',
    './kp-builder.sidebar.scss',
    './kp-builder.widgets.scss'
  ]
})
export class KpBuilderComponent implements OnInit {
  private readonly destroyRef  = inject(DestroyRef);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly api         = inject(ApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly ns          = inject(NotificationService);
  readonly autosave            = inject(AutosaveService);

  kp             = signal<Kp | null>(null);
  products       = signal<Product[]>([]);
  counterparties = signal<Counterparty[]>([]);
  loading        = signal(true);
  conditionDraft = '';
  selectedItemIds = signal<string[]>([]);
  bulkMarkupPercent = signal(0);
  bulkDiscountPercent = signal(0);
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
  lastRemovedItem = signal<KpItem | null>(null);

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

  /** Есть ли несохранённые изменения — используется в CanDeactivate guard */
  readonly isDirty = computed(() => this.autosave.status() === 'unsaved');

  /** Флаг: данные уже загружены (чтобы effect не триггерил autosave при первой загрузке) */
  private initialized = false;
  /** Первый проход effect после init пропускаем как baseline */
  private autosavePrimed = false;
  /** Автосохранение включаем только после первой позиции товара */
  private autosaveEnabled = false;
  private leaveChoice?: Subject<boolean>;

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

    forkJoin({ kp: this.api.getKp(id), counterparties: counterparties$ })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ kp, counterparties }) => {
          this.counterparties.set(counterparties);
          this.kp.set(kp);
          if (kp.items.length > 0) this.itemsCollapsed.set(false);
          this.loading.set(false);
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
    if (this.isReadOnly()) return;
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
    if (this.isReadOnly()) return;
    if (!id) return;
    const cp = this.counterparties().find(c => c._id === id);
    if (!cp) return;
    this.applyCounterpartyToKp(cp);
  }

  private applyCounterpartyToKp(cp: Counterparty) {
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({
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
    this.kp.set({ ...kp, items });
    if (items.length > 0) this.itemsCollapsed.set(false);
  }

  removeItem(item: KpItem) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.lastRemovedItem.set(item);
    this.kp.set({ ...kp, items: kp.items.filter(i => i.productId !== item.productId) });
    this.selectedItemIds.update(ids => ids.filter(id => id !== item.productId));
  }

  updateQty(item: KpItem, qty: number) {
    if (this.isReadOnly()) return;
    if (qty < 1) return;
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({ ...kp, items: kp.items.map(i => i.productId === item.productId ? { ...i, qty } : i) });
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
    this.kp.set({
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

  onBulkMarkupInput(rawValue: string | number) {
    const percent = this.clampPercent(this.parsePercentInput(rawValue), 0, 500);
    this.bulkMarkupPercent.set(percent);
    this.applyBulkMarkup();
  }

  onBulkDiscountInput(rawValue: string | number) {
    const percent = this.clampPercent(this.parsePercentInput(rawValue), 0, 100);
    this.bulkDiscountPercent.set(percent);
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
    const selected = new Set(this.selectedItemIds());
    if (selected.size === 0) return;
    const percent = this.clampPercent(this.bulkMarkupPercent(), 0, 500);
    this.bulkMarkupPercent.set(percent);
    this.kp.set({
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
    const selected = new Set(this.selectedItemIds());
    if (selected.size === 0) return;
    const percent = this.clampPercent(this.bulkDiscountPercent(), 0, 100);
    this.bulkDiscountPercent.set(percent);
    this.kp.set({
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
    const selected = new Set(this.selectedItemIds());
    if (selected.size === 0) return;
    this.kp.set({
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
    const kp = this.kp();
    if (!kp) return;
    kp.metadata.tablePageBreakAfter = Math.max(1, value || 6);
  }

  updatePhotoScalePercent(value: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    kp.metadata.photoScalePercent = this.clampPercent(value, 150, 350);
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
    this.kp.set({ ...kp, conditions: [...kp.conditions, value] });
    this.conditionDraft = '';
  }

  updateCondition(index: number, value: string) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({
      ...kp,
      conditions: kp.conditions.map((item, i) => (i === index ? value : item))
    });
  }

  removeCondition(index: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({
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
    this.kp.set({ ...kp, conditions });
  }

  moveConditionDown(index: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp || index >= kp.conditions.length - 1) return;
    const conditions = [...kp.conditions];
    [conditions[index], conditions[index + 1]] = [conditions[index + 1], conditions[index]];
    this.kp.set({ ...kp, conditions });
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
    this.kp.set({ ...kp, items: [...kp.items, removed] });
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

  productPreviewImage(product: Product): string {
    const raw = product.images.find(i => i.isMain)?.url ?? product.images[0]?.url ?? '';
    return this.normalizeImageUrl(raw);
  }

  canSelectStatus(targetStatus: Kp['status']): boolean {
    if (this.can('kp.edit') && this.can('kp.delete')) return true;
    const current = this.kp()?.status;
    if (!current) return false;
    if (current === targetStatus) return true;
    return current === 'draft' && targetStatus === 'sent';
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

  readonly conditionTemplates = [
    'Срок поставки: 15 рабочих дней с момента оплаты.',
    'Гарантия на продукцию: 12 месяцев.',
    'Доставка рассчитывается отдельно и не входит в стоимость КП.'
  ];

  openPreview() {
    this.focusCatalog.set(false);
  }

  openMoreActions() {
    this.ns.info('Доп. действия появятся в следующем этапе');
  }

  print() { window.print(); }
  back()  { this.router.navigate(['/']); }
}

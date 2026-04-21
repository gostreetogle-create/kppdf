import { Component, OnInit, signal, computed, inject, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, Kp, Product, KpItem, Counterparty } from '../../../core/services/api.service';
import { KpDocumentComponent } from '../components/kp-document/kp-document.component';
import { type KpCatalogItem } from '../components/kp-catalog/kp-catalog.component';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/ui/index';
import { AutosaveService } from './autosave.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-kp-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, KpDocumentComponent, ButtonComponent],
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
  private readonly auth        = inject(AuthService);
  readonly autosave            = inject(AutosaveService);

  kp             = signal<Kp | null>(null);
  products       = signal<Product[]>([]);
  counterparties = signal<Counterparty[]>([]);
  loading        = signal(true);
  conditionDraft = '';
  focusCatalog = signal(false);
  catalogSearch = signal('');
  catalogCategory = signal('');
  recipientCollapsed = signal(false);
  catalogCollapsed = signal(false);
  paramsCollapsed = signal(false);
  itemsCollapsed = signal(false);
  conditionsCollapsed = signal(false);
  lastRemovedItem = signal<KpItem | null>(null);
  manualItemDraft = {
    name: '',
    code: '',
    unit: 'шт',
    price: 0,
    qty: 1
  };

  readonly canAddManualItem = computed(() =>
    this.manualItemDraft.name.trim().length > 0
  );

  // ─── computed ─────────────────────────────────────────
  readonly catalogItems = computed<KpCatalogItem[]>(() =>
    (this.kp()?.items ?? []).map(i => ({
      id:          i.productId,
      code:        i.code,
      name:        i.name,
      description: i.description,
      unit:        i.unit,
      price:       i.price,
      qty:         i.qty,
      imageUrl:    this.normalizeImageUrl(i.imageUrl)
    }))
  );

  readonly subtotal = computed(() =>
    this.kp()?.items.reduce((s, i) => s + i.price * i.qty, 0) ?? 0
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
  readonly isAdmin = this.auth.isAdmin;
  readonly isManager = this.auth.isManager;
  readonly isReadOnly = computed(() => {
    const status = this.kp()?.status;
    return status === 'sent' || status === 'accepted';
  });

  /** Есть ли несохранённые изменения — используется в CanDeactivate guard */
  readonly isDirty = computed(() => this.autosave.status() === 'unsaved');

  /** Флаг: данные уже загружены (чтобы effect не триггерил autosave при первой загрузке) */
  private initialized = false;

  constructor() {
    effect(() => {
      const kp = this.kp();
      if (!kp || !this.initialized) return;
      this.autosave.schedule(kp);
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;

    this.api.getKp(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(kp => {
        this.kp.set(kp);
        this.loading.set(false);
        // Откладываем на следующий макротаск — effect уже отработал с начальным значением
        Promise.resolve().then(() => { this.initialized = true; });
      });

    this.api.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => this.products.set(p));

    this.api.getCounterparties({ status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => this.counterparties.set(
        list.filter(c => c.role.includes('client') || c.role.includes('company'))
      ));
  }

  /** Заполнить получателя из справочника контрагентов */
  fillFromCounterparty(id: string) {
    if (this.isReadOnly()) return;
    if (!id) return;
    const cp  = this.counterparties().find(c => c._id === id);
    const kp  = this.kp();
    if (!cp || !kp) return;
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
          imageUrl:    this.normalizeImageUrl(product.images.find(i => i.isMain)?.url ?? product.images[0]?.url ?? '')
        }];
    this.kp.set({ ...kp, items });
  }

  removeItem(item: KpItem) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    this.lastRemovedItem.set(item);
    this.kp.set({ ...kp, items: kp.items.filter(i => i.productId !== item.productId) });
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

  addManualItem() {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    const name = this.manualItemDraft.name.trim();
    if (!name) return;
    const qty = Math.max(1, Number(this.manualItemDraft.qty) || 1);
    const price = Math.max(0, Number(this.manualItemDraft.price) || 0);
    const unit = this.manualItemDraft.unit.trim() || 'шт';
    const code = this.manualItemDraft.code.trim();
    const manualItem: KpItem = {
      productId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      name,
      description: '',
      unit,
      price,
      qty,
      imageUrl: ''
    };
    this.kp.set({ ...kp, items: [...kp.items, manualItem] });
    this.manualItemDraft = { name: '', code: '', unit: 'шт', price: 0, qty: 1 };
  }

  updateTablePageBreakAfter(value: number) {
    if (this.isReadOnly()) return;
    const kp = this.kp();
    if (!kp) return;
    kp.metadata.tablePageBreakAfter = Math.max(1, value || 10);
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
    if (this.isAdmin()) return true;
    const current = this.kp()?.status;
    if (!current) return false;
    if (current === targetStatus) return true;
    return current === 'draft' && targetStatus === 'sent';
  }

  private normalizeImageUrl(url?: string): string {
    if (!url) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return url;

    let normalized = url.replace(/\\/g, '/').trim();
    normalized = normalized.replace(/^\.?\//, '');
    if (normalized.startsWith('media/')) return `/${normalized}`;
    if (normalized.startsWith('products/')) return `/media/${normalized}`;
    if (normalized.startsWith('kp/')) return `/media/${normalized}`;
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  readonly conditionTemplates = [
    'Срок поставки: 15 рабочих дней с момента оплаты.',
    'Гарантия на продукцию: 12 месяцев.',
    'Доставка рассчитывается отдельно и не входит в стоимость КП.'
  ];

  print() { window.print(); }
  back()  { this.router.navigate(['/']); }
}

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

@Component({
  selector: 'app-kp-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, KpDocumentComponent, ButtonComponent],
  providers: [AutosaveService],   // scope — только этот компонент
  templateUrl: './kp-builder.component.html',
  styleUrl: './kp-builder.component.scss'
})
export class KpBuilderComponent implements OnInit {
  private readonly destroyRef  = inject(DestroyRef);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly api         = inject(ApiService);
  readonly autosave            = inject(AutosaveService);

  kp             = signal<Kp | null>(null);
  products       = signal<Product[]>([]);
  counterparties = signal<Counterparty[]>([]);
  loading        = signal(true);
  innQuery       = '';
  lookingUp      = signal(false);
  lookupError    = signal('');

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
      imageUrl:    i.imageUrl ?? ''
    }))
  );

  readonly subtotal = computed(() =>
    this.kp()?.items.reduce((s, i) => s + i.price * i.qty, 0) ?? 0
  );
  readonly vatAmount = computed(() =>
    Math.round(this.subtotal() * (this.kp()?.vatPercent ?? 20) / 100)
  );
  readonly total = computed(() => this.subtotal() + this.vatAmount());

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

    this.api.getCounterparties({ role: 'client', status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => this.counterparties.set(list));
  }

  /** Поиск компании по ИНН через DaData → автозаполнение получателя */
  lookupByInn() {
    const inn = this.innQuery.trim();
    if (!inn) return;
    // Валидация формата ИНН: 10 цифр (юрлицо) или 12 (ИП)
    if (!/^\d{10}(\d{2})?$/.test(inn)) {
      this.lookupError.set('ИНН должен содержать 10 или 12 цифр');
      return;
    }
    this.lookingUp.set(true);
    this.lookupError.set('');

    this.api.lookupCounterpartyByInn(inn)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cp => {
          this.lookingUp.set(false);
          const kp = this.kp();
          if (!kp) return;
          this.kp.set({
            ...kp,
            recipient: {
              ...kp.recipient,
              name:             cp.name         ?? kp.recipient.name,
              shortName:        cp.shortName    ?? kp.recipient.shortName,
              legalForm:        cp.legalForm    ?? kp.recipient.legalForm,
              inn:              cp.inn          ?? kp.recipient.inn,
              kpp:              cp.kpp          ?? kp.recipient.kpp,
              ogrn:             cp.ogrn         ?? kp.recipient.ogrn,
              legalAddress:     cp.legalAddress ?? kp.recipient.legalAddress,
              founderName:      cp.founderName  ?? kp.recipient.founderName,
              founderNameShort: cp.founderNameShort ?? kp.recipient.founderNameShort,
            }
          });
          this.innQuery = '';
        },
        error: err => {
          this.lookingUp.set(false);
          this.lookupError.set(err.error?.message ?? 'Компания не найдена');
        }
      });
  }

  /** Заполнить получателя из справочника контрагентов */
  fillFromCounterparty(id: string) {
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
          imageUrl:    product.images.find(i => i.isMain)?.url ?? product.images[0]?.url ?? ''
        }];
    this.kp.set({ ...kp, items });
  }

  removeItem(productId: string) {
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({ ...kp, items: kp.items.filter(i => i.productId !== productId) });
  }

  updateQty(item: KpItem, qty: number) {
    if (qty < 1) return;
    const kp = this.kp();
    if (!kp) return;
    this.kp.set({ ...kp, items: kp.items.map(i => i.productId === item.productId ? { ...i, qty } : i) });
  }

  /** Ручное сохранение — немедленно, сбрасывает дебаунс */
  save() {
    const kp = this.kp();
    if (!kp) return;
    this.autosave.saveNow(kp);
  }

  print() { window.print(); }
  back()  { this.router.navigate(['/']); }
}

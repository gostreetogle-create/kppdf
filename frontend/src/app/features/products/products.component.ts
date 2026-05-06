import { Component, OnInit, signal, computed, inject, DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take, combineLatest, debounceTime, switchMap, catchError, of } from 'rxjs';
import { ApiService, Product } from '../../core/services/api.service';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductSpecEditorComponent } from './components/product-spec-editor/product-spec-editor.component';
import { ButtonComponent, SearchInputComponent, FilterSelectComponent, DrawerComponent, PageLayoutComponent, PageHeaderComponent, EmptyStateComponent, AlertComponent } from '../../shared/ui/index';
import { NotificationService } from '../../core/services/notification.service';
import { ModalService } from '../../core/services/modal.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProductFormComponent,
    ProductCardComponent,
    ProductSpecEditorComponent,
    DrawerComponent,
    ButtonComponent,
    AlertComponent,
    SearchInputComponent,
    FilterSelectComponent,
    PageLayoutComponent,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  templateUrl: './products.component.html',
  styleUrls: [
    './products.component.scss',
    './products.controls.scss',
    './products.table.scss'
  ]
})
export class ProductsComponent implements OnInit {
  private readonly api          = inject(ApiService);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly modal        = inject(ModalService);
  private readonly notification = inject(NotificationService);

  products        = signal<Product[]>([]);
  loading         = signal(true);
  error           = signal('');
  search          = signal('');
  filterCategory  = signal('');
  filterHasSpec   = signal<boolean | null>(null);
  view            = signal<'grid' | 'table'>('grid');
  page            = signal(1);
  limit           = signal(24);
  total           = signal(0);
  formOpen        = signal(false);
  editTarget      = signal<Product | null>(null);
  deleteTarget    = signal<Product | null>(null);
  specTarget      = signal<Product | null>(null);
  categories      = signal<string[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit())));

  ngOnInit() {
    this.api.getProductCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cats => this.categories.set(cats));

    effect(() => {
      this.search();
      this.filterCategory();
      this.filterHasSpec();
      this.page.set(1);
    });

    combineLatest([
      toObservable(this.search),
      toObservable(this.filterCategory),
      toObservable(this.filterHasSpec),
      toObservable(this.page),
      toObservable(this.limit),
    ])
      .pipe(
        debounceTime(300),
        switchMap(([q, category, hasSpec, page, limit]) => {
          this.loading.set(true);
          this.error.set('');
          return this.api
            .getProductsPage({
              page,
              limit,
              q: q || undefined,
              category: category || undefined,
              hasSpec,
            })
            .pipe(
              catchError((err) => {
                const message = err?.error?.message ?? 'Не удалось загрузить каталог';
                this.error.set(message);
                return of({ items: [], page, limit, total: 0 });
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((resp) => {
        this.products.set(resp.items);
        this.total.set(resp.total);
        this.loading.set(false);
      });
  }

  setHasSpecFilter(value: string) {
    this.filterHasSpec.set(value === '' ? null : value === 'true');
  }

  setLimit(value: string) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num) || num <= 0) return;
    this.limit.set(num);
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
  }

  nextPage() {
    if (this.page() >= this.totalPages()) return;
    this.page.set(this.page() + 1);
  }

  openCreate() { this.editTarget.set(null); this.formOpen.set(true); }
  openEdit(p: Product) { this.editTarget.set(p); this.formOpen.set(true); }

  openDuplicate(p: Product) {
    this.loading.set(true);
    this.api.duplicateProduct(p._id).subscribe({
      next: (copy) => {
        this.products.update(list => [copy, ...list]);
        this.total.update(v => v + 1);
        this.loading.set(false);
        this.editTarget.set(copy);
        this.formOpen.set(true);
        this.notification.success('Товар скопирован. Теперь вы можете внести изменения.');
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Не удалось скопировать товар');
      }
    });
  }

  closeForm() { this.formOpen.set(false); this.editTarget.set(null); }
  openSpecEditor(product: Product) { this.specTarget.set(product); }
  closeSpecEditor() { this.specTarget.set(null); }
  onSpecSaved() {
    this.notification.success('Технический профиль сохранён');
    const current = this.products();
    const specTarget = this.specTarget();
    if (!specTarget) return;
    if (!current.some(p => p._id === specTarget._id)) return;
    this.api.getProduct(specTarget._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => this.products.update(list => list.map(x => x._id === p._id ? p : x)),
        error: () => {}
      });
  }

  onSaved(product: Product) {
    const isEdit = !!this.editTarget();
    this.products.update(list =>
      isEdit ? list.map(p => p._id === product._id ? product : p) : [product, ...list]
    );
    this.closeForm();
    this.notification.success(isEdit ? 'Товар обновлён' : 'Товар создан');
  }

  confirmDelete(product: Product) {
    this.modal.confirm({
      title: 'Удалить товар',
      message: `Товар «${product.name}» будет удалён без возможности восстановления.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleteTarget.set(product);
        this.onDeleteConfirmed();
      });
  }

  onDeleteConfirmed() {
    const p = this.deleteTarget();
    if (!p) return;
    this.api.deleteProduct(p._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => {
          this.products.update(list => list.filter(x => x._id !== p._id));
          this.deleteTarget.set(null);
          this.total.update(v => Math.max(0, v - 1));
          this.notification.success('Товар удалён');
        },
        error: () => {
          this.deleteTarget.set(null);
          this.notification.error('Не удалось удалить товар');
        }
      });
  }

  kindLabel(kind: string): string {
    return { ITEM: 'Товар', SERVICE: 'Услуга', WORK: 'Работа' }[kind] ?? kind;
  }
}

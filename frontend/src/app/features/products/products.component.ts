import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { ApiService, Product } from '../../core/services/api.service';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductSpecEditorComponent } from './components/product-spec-editor/product-spec-editor.component';
import { ButtonComponent, SearchInputComponent, FilterSelectComponent, DrawerComponent } from '../../shared/ui/index';
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
    SearchInputComponent,
    FilterSelectComponent
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
  search          = signal('');
  filterCategory  = signal('');
  filterHasSpec   = signal<boolean | null>(null);
  view            = signal<'grid' | 'table'>('grid');
  formOpen        = signal(false);
  editTarget      = signal<Product | null>(null);
  deleteTarget    = signal<Product | null>(null);
  specTarget      = signal<Product | null>(null);
  categories      = signal<string[]>([]);

  readonly filtered = computed(() => {
    const q   = this.search().toLowerCase();
    const cat = this.filterCategory();
    return this.products().filter(p => {
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      const matchCat = !cat || p.category === cat;
      const matchSpec = this.filterHasSpec() == null
        ? true
        : this.filterHasSpec() ? !!p.specId : !p.specId;
      return matchSearch && matchCat && matchSpec;
    });
  });

  ngOnInit() {
    this.load();
    this.api.getProductCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cats => this.categories.set(cats));
  }

  load() {
    this.loading.set(true);
    this.api.getProducts(this.filterHasSpec() == null ? undefined : { hasSpec: this.filterHasSpec() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => { this.products.set(list); this.loading.set(false); },
        error: ()  => this.loading.set(false)
      });
  }

  setHasSpecFilter(value: string) {
    this.filterHasSpec.set(value === '' ? null : value === 'true');
    this.load();
  }

  openCreate() { this.editTarget.set(null); this.formOpen.set(true); }
  openEdit(p: Product) { this.editTarget.set(p); this.formOpen.set(true); }
  closeForm() { this.formOpen.set(false); this.editTarget.set(null); }
  openSpecEditor(product: Product) { this.specTarget.set(product); }
  closeSpecEditor() { this.specTarget.set(null); }
  onSpecSaved() {
    this.notification.success('Технический профиль сохранён');
    this.load();
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

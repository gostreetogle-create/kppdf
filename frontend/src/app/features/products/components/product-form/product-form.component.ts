import { Component, OnInit, OnDestroy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ApiService, Product, ProductImage, ProductKind, createImage } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

interface ProductForm {
  code:        string;
  name:        string;
  description: string;
  category:    string;
  subcategory: string;
  unit:        string;
  price:       number | null;
  costRub:     number | null;
  kind:        ProductKind;
  isActive:    boolean;
  notes:       string;
  images:      ProductImage[];
  newImageUrl: string; // временное поле для добавления фото
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, FormFieldComponent, AlertComponent, ButtonComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss'
})
export class ProductFormComponent implements OnInit, OnDestroy {
  private readonly api     = inject(ApiService);
  private readonly destroy$ = new Subject<void>();

  product   = input<Product | null>(null);
  compactForKp = input(false);
  saved     = output<Product>();
  cancelled = output<void>();

  form: ProductForm = {
    code: '', name: '', description: '', category: '', subcategory: '',
    unit: '', price: null, costRub: null, kind: 'ITEM',
    isActive: true, notes: '', images: [], newImageUrl: ''
  };

  saving     = signal(false);
  errors     = signal<string[]>([]);
  categories = signal<string[]>([]);
  units      = signal<string[]>(['шт.', 'м²', 'м.п.', 'кг', 'т', 'комплект', 'рейс', 'услуга']);

  readonly kinds: { value: ProductKind; label: string }[] = [
    { value: 'ITEM',    label: 'Товар' },
    { value: 'SERVICE', label: 'Услуга' },
    { value: 'WORK',    label: 'Работа' },
  ];

  ngOnInit() {
    // Загружаем справочники параллельно
    forkJoin({
      categories: this.api.getProductCategories(),
      units:      this.api.getDictionaries('unit'),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ categories, units }) => {
      this.categories.set(categories);
      if (units.length) this.units.set(units.map(u => u.value));
    });

    const p = this.product();
    if (p) {
      this.form = {
        code:        p.code,
        name:        p.name,
        description: p.description,
        category:    p.category,
        subcategory: p.subcategory ?? '',
        unit:        p.unit,
        price:       p.price,
        costRub:     p.costRub ?? null,
        kind:        p.kind,
        isActive:    p.isActive,
        notes:       p.notes ?? '',
        images:      [...p.images],
        newImageUrl: ''
      };
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  get isEdit(): boolean { return !!this.product(); }
  get modalTitle(): string {
    if (this.compactForKp()) {
      return this.isEdit ? 'Товар в КП' : 'Добавить товар в КП';
    }
    return this.isEdit ? 'Редактировать товар' : 'Новый товар';
  }

  get mainImage(): ProductImage | undefined {
    return this.form.images.find(i => i.isMain) ?? this.form.images[0];
  }

  addImage() {
    const url = this.form.newImageUrl.trim();
    if (!url) return;
    const isFirst = this.form.images.length === 0;
    this.form.images = [
      ...this.form.images,
      createImage(url, { isMain: isFirst, sortOrder: this.form.images.length, context: 'product' }),
    ];
    this.form.newImageUrl = '';
  }

  removeImage(index: number) {
    this.form.images = this.form.images
      .filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, sortOrder: i }));
    if (this.form.images.length && !this.form.images.some(i => i.isMain)) {
      this.form.images[0] = { ...this.form.images[0], isMain: true };
    }
  }

  setMain(index: number) {
    this.form.images = this.form.images.map((img, i) => ({ ...img, isMain: i === index }));
  }

  validate(): boolean {
    const errs: string[] = [];
    if (!this.form.code.trim())  errs.push('Введите артикул');
    if (!this.form.name.trim())  errs.push('Введите название');
    if (!this.form.unit.trim())  errs.push('Выберите единицу измерения');
    if (this.form.price == null || this.form.price < 0) errs.push('Введите корректную цену');
    this.errors.set(errs);
    return errs.length === 0;
  }

  submit() {
    if (!this.validate()) return;
    this.saving.set(true);
    this.errors.set([]);

    const payload: Omit<Product, '_id'> = {
      code:        this.form.code.trim(),
      name:        this.form.name.trim(),
      description: this.form.description.trim(),
      category:    this.form.category.trim(),
      subcategory: this.form.subcategory.trim() || undefined,
      unit:        this.form.unit,
      price:       this.form.price!,
      costRub:     this.form.costRub ?? undefined,
      images:      this.form.images,
      isActive:    this.form.isActive,
      kind:        this.form.kind,
      notes:       this.form.notes.trim() || undefined,
    };

    const req$ = this.isEdit
      ? this.api.updateProduct(this.product()!._id, payload)
      : this.api.createProduct(payload);

    req$.subscribe({
      next:  p => { this.saving.set(false); this.saved.emit(p); },
      error: err => {
        this.saving.set(false);
        this.errors.set(err.error?.errors ?? ['Ошибка при сохранении']);
      }
    });
  }
}

import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  Product,
  ProductSpecDrawings,
  ProductSpecGroup,
  ProductSpecTemplate
} from '../../../../core/services/api.service';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProductSpecViewerComponent } from '../product-spec-viewer/product-spec-viewer.component';

@Component({
  selector: 'app-product-spec-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AlertComponent,
    ButtonComponent,
    ProductSpecViewerComponent
  ],
  templateUrl: './product-spec-editor.component.html',
  styleUrl: './product-spec-editor.component.scss'
})
export class ProductSpecEditorComponent implements OnInit {
  private readonly api = inject(ApiService);

  productId = input.required<string>();
  productName = input.required<string>();
  productCode = input.required<string>();
  closed = output<void>();
  saved = output<void>();

  loading = signal(true);
  saving = signal(false);
  downloading = signal(false);
  copying = signal(false);
  templatesLoading = signal(false);
  templates = signal<ProductSpecTemplate[]>([]);
  selectedTemplateKey = signal('');
  showPreview = signal(false);
  specMissing = signal(false);
  errors = signal<string[]>([]);
  readonly visibleErrors = computed(() => this.errors()
    .map((message) => String(message ?? '').trim())
    .filter((message) => message.length > 0));
  productsCatalog = signal<Product[]>([]);
  copySearch = signal('');
  selectedSourceProductId = signal('');
  copyWithDrawings = signal(true);
  copySectionOpen = signal(false);

  drawings: ProductSpecDrawings = {};
  groups: ProductSpecGroup[] = [];

  ngOnInit(): void {
    this.loadProductsCatalog();
    this.loadTemplates();
    this.loadSpec();
  }

  private loadTemplates() {
    this.templatesLoading.set(true);
    this.api.getProductSpecTemplates().subscribe({
      next: (templates) => {
        this.templates.set(Array.isArray(templates) ? templates : []);
        this.templatesLoading.set(false);
      },
      error: () => {
        this.templates.set([]);
        this.templatesLoading.set(false);
      }
    });
  }

  private loadProductsCatalog() {
    this.api.getProducts().subscribe({
      next: (products) => this.productsCatalog.set(products),
      error: () => this.productsCatalog.set([])
    });
  }

  private loadSpec() {
    this.loading.set(true);
    this.specMissing.set(false);
    this.errors.set([]);
    this.api.getProductSpecByProductId(this.productId()).subscribe({
      next: (spec) => {
        if (!spec) {
          this.drawings = {};
          this.groups = [];
          this.specMissing.set(true);
          this.loading.set(false);
          return;
        }
        this.drawings = { ...(spec.drawings ?? {}) };
        this.groups = Array.isArray(spec.groups) ? spec.groups.map((group) => ({
          title: group.title,
          params: (group.params ?? []).map((param) => ({ ...param }))
        })) : [];
        this.specMissing.set(false);
        this.loading.set(false);
      },
      error: (error) => {
        const status = error instanceof HttpErrorResponse ? error.status : Number(error?.status);
        if (status === 404) {
          this.drawings = {};
          this.groups = [];
          this.specMissing.set(true);
          this.loading.set(false);
          return;
        }
        this.setError(error, 'Не удалось загрузить тех. профиль');
        this.groups = [];
        this.drawings = {};
        this.specMissing.set(false);
        this.loading.set(false);
      }
    });
  }

  addGroup() {
    this.groups = [...this.groups, { title: '', params: [{ name: '', value: '' }] }];
  }

  removeGroup(index: number) {
    this.groups = this.groups.filter((_, i) => i !== index);
  }

  addParam(groupIndex: number) {
    this.groups = this.groups.map((group, index) => (
      index !== groupIndex
        ? group
        : { ...group, params: [...group.params, { name: '', value: '' }] }
    ));
  }

  removeParam(groupIndex: number, paramIndex: number) {
    this.groups = this.groups.map((group, index) => (
      index !== groupIndex
        ? group
        : { ...group, params: group.params.filter((_, i) => i !== paramIndex) }
    ));
  }

  updateDrawing(field: keyof ProductSpecDrawings, value: string) {
    this.drawings = { ...this.drawings, [field]: value.trim() || undefined };
  }

  clearDrawing(field: keyof ProductSpecDrawings) {
    this.drawings = { ...this.drawings, [field]: undefined };
  }

  onUploadDrawing(field: keyof ProductSpecDrawings, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.api.uploadProductSpecDrawing(file).subscribe({
      next: ({ url }) => this.updateDrawing(field, url),
      error: (error) => this.setError(error, 'Не удалось загрузить изображение')
    });
    input.value = '';
  }

  normalizedGroups(): ProductSpecGroup[] {
    return this.groups
      .map((group) => ({
        title: group.title.trim(),
        params: (group.params ?? [])
          .map((param) => ({ name: param.name.trim(), value: param.value.trim() }))
          .filter((param) => param.name && param.value)
      }))
      .filter((group) => group.title && group.params.length > 0);
  }

  copySourceCandidates(): Product[] {
    const q = this.copySearch().trim().toLowerCase();
    return this.productsCatalog()
      .filter((item) => item._id !== this.productId())
      .filter((item) => !q
        || item.name.toLowerCase().includes(q)
        || item.code.toLowerCase().includes(q));
  }

  copyFromProduct(sourceProductId: string) {
    if (!sourceProductId) {
      this.errors.set(['Выберите товар-источник для копирования']);
      return;
    }
    this.copying.set(true);
    this.errors.set([]);
    this.api.getProductSpecByProductId(sourceProductId).subscribe({
      next: (sourceSpec) => {
        if (!sourceSpec) {
          this.copying.set(false);
          this.errors.set(['У выбранного товара нет тех. профиля для копирования']);
          return;
        }
        this.groups = Array.isArray(sourceSpec.groups)
          ? sourceSpec.groups.map((group) => ({
            title: group.title,
            params: (group.params ?? []).map((param) => ({ ...param }))
          }))
          : [];
        if (this.copyWithDrawings()) {
          this.drawings = { ...(sourceSpec.drawings ?? {}) };
        }
        this.copying.set(false);
      },
      error: (error) => {
        this.copying.set(false);
        this.setError(error, 'Не удалось скопировать тех. профиль');
      }
    });
  }

  applyTemplate() {
    const key = this.selectedTemplateKey();
    if (!key) {
      this.errors.set(['Выберите шаблон для применения']);
      return;
    }
    const template = this.templates().find((item) => item.key === key);
    if (!template) {
      this.errors.set(['Выбранный шаблон не найден']);
      return;
    }
    this.groups = (template.groups ?? []).map((group) => ({
      title: group.title,
      params: (group.params ?? []).map((param) => ({ ...param }))
    }));
    this.specMissing.set(false);
    this.errors.set([]);
  }

  save() {
    this.saving.set(true);
    this.errors.set([]);
    this.api.upsertProductSpec(this.productId(), {
      drawings: this.drawings,
      groups: this.normalizedGroups()
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (error) => {
        this.saving.set(false);
        this.setError(error, 'Не удалось сохранить тех. профиль');
      }
    });
  }

  exportPassport() {
    this.downloading.set(true);
    this.api.exportProductPassportPdf(this.productId()).subscribe({
      next: (blob) => {
        const fileName = `passport-${this.productCode()}.pdf`;
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        this.downloading.set(false);
      },
      error: (error) => {
        this.downloading.set(false);
        this.setError(error, 'Не удалось выгрузить PDF');
      }
    });
  }

  private setError(error: unknown, fallback: string) {
    const message = this.extractErrorMessage(error) || fallback;
    this.errors.set([message]);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payloadMessage = typeof error.error === 'object' && error.error
        ? String((error.error as Record<string, unknown>)['message'] ?? '').trim()
        : '';
      return payloadMessage || String(error.message ?? '').trim();
    }
    if (typeof error === 'object' && error) {
      return String((error as { message?: unknown }).message ?? '').trim();
    }
    return '';
  }
}

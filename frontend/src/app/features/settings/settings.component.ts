import { Component, OnInit, signal, inject, DestroyRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService, Setting, SettingsMap, Product, Counterparty } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/ui/index';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly ns         = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  settings = signal<Setting[]>([]);
  loading  = signal(true);
  saving   = signal(false);
  jsonBusy = signal(false);

  @ViewChild('productsFileInput') productsFileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('counterpartiesFileInput') counterpartiesFileInputRef!: ElementRef<HTMLInputElement>;

  readonly productImportTemplate = {
    items: [
      {
        code: 'ART-001',
        name: 'Пример товара',
        description: 'Описание товара',
        category: 'Категория',
        subcategory: 'Подкатегория',
        unitCode: 'шт',
        priceRub: 1000,
        costRub: 700,
        kind: 'ITEM',
        isActive: true,
        images: [{ url: 'https://example.com/image.jpg', isMain: true, sortOrder: 0 }]
      }
    ]
  };

  readonly counterpartyImportTemplate = {
    items: [
      {
        legalForm: 'ООО',
        role: ['client'],
        name: 'ООО Пример Контрагент',
        shortName: 'Пример Контрагент',
        inn: '7707083893',
        kpp: '770701001',
        legalAddress: 'г. Москва, ул. Пример, д. 1',
        phone: '+7 (495) 000-00-00',
        email: 'info@example.ru',
        status: 'active',
        tags: ['клиент', 'импорт']
      }
    ]
  };

  // Локальная копия для редактирования
  values: Record<string, unknown> = {};

  ngOnInit() {
    this.api.getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list }) => {
          this.settings.set(list);
          list.forEach(s => { this.values[s.key] = s.value; });
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.ns.error('Не удалось загрузить настройки'); }
      });
  }

  save() {
    this.saving.set(true);
    this.api.updateSettings(this.values as SettingsMap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list }) => {
          this.settings.set(list);
          this.saving.set(false);
          this.ns.success('Настройки сохранены');
        },
        error: () => { this.saving.set(false); this.ns.error('Ошибка сохранения'); }
      });
  }

  isNumberValue(value: unknown): boolean {
    return typeof value === 'number';
  }

  kpSettings(): Setting[] {
    return this.settings().filter(s =>
      s.key === 'kp_validity_days'
      || s.key === 'kp_prepayment_percent'
      || s.key === 'kp_production_days'
      || s.key === 'kp_vat_percent'
    );
  }

  downloadProductsImportTemplate() {
    this.downloadJson(this.productImportTemplate, 'products-import-template.json');
  }

  downloadCounterpartiesImportTemplate() {
    this.downloadJson(this.counterpartyImportTemplate, 'counterparties-import-template.json');
  }

  exportProductsJson() {
    this.jsonBusy.set(true);
    this.api.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: Product[]) => {
          this.downloadJson({ items }, `products-export-${new Date().toISOString().slice(0, 10)}.json`);
          this.jsonBusy.set(false);
          this.ns.success(`Экспорт товаров готов: ${items.length} позиций`);
        },
        error: () => {
          this.jsonBusy.set(false);
          this.ns.error('Не удалось экспортировать товары');
        }
      });
  }

  exportCounterpartiesJson() {
    this.jsonBusy.set(true);
    this.api.getCounterparties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: Counterparty[]) => {
          this.downloadJson({ items }, `counterparties-export-${new Date().toISOString().slice(0, 10)}.json`);
          this.jsonBusy.set(false);
          this.ns.success(`Экспорт контрагентов готов: ${items.length} записей`);
        },
        error: () => {
          this.jsonBusy.set(false);
          this.ns.error('Не удалось экспортировать контрагентов');
        }
      });
  }

  exportMissingPhotosReport() {
    this.jsonBusy.set(true);
    this.api.getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          const missing = products
            .filter(product => !product.images || product.images.length === 0 || !product.images[0]?.url)
            .map(product => ({ code: product.code, name: product.name, category: product.category }));
          this.downloadJson(
            { totalMissing: missing.length, items: missing },
            `missing-photos-${new Date().toISOString().slice(0, 10)}.json`
          );
          this.jsonBusy.set(false);
          this.ns.success(`Отчёт готов: ${missing.length} товаров без фото`);
        },
        error: () => {
          this.jsonBusy.set(false);
          this.ns.error('Не удалось сформировать отчёт по фото');
        }
      });
  }

  triggerProductsImport() {
    this.productsFileInputRef.nativeElement.value = '';
    this.productsFileInputRef.nativeElement.click();
  }

  triggerCounterpartiesImport() {
    this.counterpartiesFileInputRef.nativeElement.value = '';
    this.counterpartiesFileInputRef.nativeElement.click();
  }

  onProductsImportSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.readJsonFile(file, items => this.runProductsImport(items));
  }

  onCounterpartiesImportSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.readJsonFile(file, items => this.runCounterpartiesImport(items));
  }

  private readJsonFile(file: File, onItems: (items: any[]) => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const items: any[] = Array.isArray(raw) ? raw : raw.items;
        if (!Array.isArray(items) || items.length === 0) {
          this.ns.error('Файл не содержит массив items');
          return;
        }
        onItems(items);
      } catch {
        this.ns.error('Не удалось разобрать JSON-файл');
      }
    };
    reader.readAsText(file);
  }

  private runProductsImport(items: any[]) {
    this.runBatchedImport(items, (batch) => this.sendProductsBatchWithFallback(batch), 'товаров');
  }

  private runCounterpartiesImport(items: any[]) {
    this.runBatchedImport(items, (batch) => this.sendCounterpartiesBatchWithFallback(batch), 'контрагентов');
  }

  private runBatchedImport(
    items: any[],
    importer: (batch: any[]) => Promise<{ created: number; updated: number; skipped: number; errors: string[] }>,
    label: string
  ) {
    const batchSize = 50;
    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));

    this.jsonBusy.set(true);
    const summary = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
    void (async () => {
      try {
        for (const batch of batches) {
          const result = await importer(batch);
          summary.created += result.created;
          summary.updated += result.updated;
          summary.skipped += result.skipped;
          summary.errors.push(...result.errors);
        }
        const msg = `Импорт ${label}: создано ${summary.created}, пропущено ${summary.skipped}, ошибок ${summary.errors.length}.`;
        if (summary.errors.length > 0) {
          this.ns.error(`${msg} Причины: ${summary.errors.slice(0, 3).join(' | ')}`);
        } else {
          this.ns.success(msg);
        }
      } catch {
        this.ns.error(`Ошибка при импорте ${label}`);
      } finally {
        this.jsonBusy.set(false);
      }
    })();
  }

  private async sendProductsBatchWithFallback(items: any[]): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    try {
      return await firstValueFrom(this.api.bulkImportProducts(items, 'skip'));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 413) throw error;
      if (items.length <= 1) throw error;
      const middle = Math.ceil(items.length / 2);
      const leftResult = await this.sendProductsBatchWithFallback(items.slice(0, middle));
      const rightResult = await this.sendProductsBatchWithFallback(items.slice(middle));
      return {
        created: leftResult.created + rightResult.created,
        updated: leftResult.updated + rightResult.updated,
        skipped: leftResult.skipped + rightResult.skipped,
        errors: [...leftResult.errors, ...rightResult.errors]
      };
    }
  }

  private async sendCounterpartiesBatchWithFallback(items: any[]): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    try {
      return await firstValueFrom(this.api.bulkImportCounterparties(items, 'skip'));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 413) throw error;
      if (items.length <= 1) throw error;
      const middle = Math.ceil(items.length / 2);
      const leftResult = await this.sendCounterpartiesBatchWithFallback(items.slice(0, middle));
      const rightResult = await this.sendCounterpartiesBatchWithFallback(items.slice(middle));
      return {
        created: leftResult.created + rightResult.created,
        updated: leftResult.updated + rightResult.updated,
        skipped: leftResult.skipped + rightResult.skipped,
        errors: [...leftResult.errors, ...rightResult.errors]
      };
    }
  }

  private downloadJson(payload: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

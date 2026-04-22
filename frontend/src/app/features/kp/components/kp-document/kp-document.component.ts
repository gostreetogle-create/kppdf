import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpBackgroundComponent } from '../kp-background/kp-background.component';
import { KpHeaderComponent, type KpRecipient, type KpMetadata } from '../kp-header/kp-header.component';
import { KpCatalogComponent, type KpCatalogItem } from '../kp-catalog/kp-catalog.component';
import { KpTableComponent, type KpTotals } from '../kp-table/kp-table.component';

interface KpPageChunk {
  items: KpCatalogItem[];
  displayOffset: number;
  useFirstBackground: boolean;
  showHeader: boolean;
  showTotals: boolean;
}

interface CompanySnapshotImage {
  url: string;
  context: 'kp-page1' | 'kp-page2' | 'passport';
}

interface CompanySnapshot {
  name: string;
  images: CompanySnapshotImage[];
  footerText: string;
}

@Component({
  selector: 'app-kp-document',
  standalone: true,
  imports: [
    CommonModule, 
    KpBackgroundComponent, 
    KpHeaderComponent, 
    KpCatalogComponent, 
    KpTableComponent
  ],
  templateUrl: './kp-document.component.html',
  styleUrl: './kp-document.component.scss'
})
export class KpDocumentComponent {
  itemsPerPage = input(10);

  recipient = input<KpRecipient>({
    name: 'ООО "Пример Компания"',
    inn: '1234567890',
    email: 'info@example.com',
    phone: '+7 (999) 123-45-67'
  });

  metadata = input<KpMetadata>({
    number: 'КП-2024-001',
    validityDays: 10,
    prepaymentPercent: 50,
    productionDays: 15,
    tablePageBreakAfter: 6,
    photoScalePercent: 150
  });

  items = input<KpCatalogItem[]>([]);
  conditions = input<string[]>([]);
  vatPercent = input<number>(20);
  companySnapshot = input<CompanySnapshot | null>(null);

  protected readonly totals = computed((): KpTotals => {
    const subtotal = this.items().reduce((s, i) => s + i.price * i.qty, 0);
    const vatPercent = this.vatPercent();
    const vatAmount = Math.round(subtotal * vatPercent / (100 + vatPercent));
    return { subtotal, vatPercent, vatAmount, total: subtotal };
  });

  protected readonly hasDescriptionColumn = computed(() =>
    this.items().some(item => (item.description ?? '').trim().length > 0)
  );

  protected readonly hasPhotoColumn = computed(() =>
    this.items().some(item => (item.imageUrl ?? '').trim().length > 0)
  );

  protected readonly hasCodeColumn = computed(() =>
    this.items().some(item => (item.code ?? '').trim().length > 0)
  );

  protected readonly resolvedItemsPerPage = computed(() =>
    Math.max(1, Number(this.itemsPerPage()) || 6)
  );

  protected readonly pageChunks = computed((): KpPageChunk[] => {
    const chunks: KpPageChunk[] = [];
    const perPage = this.resolvedItemsPerPage();
    const allItems = this.items();

    if (allItems.length === 0) {
      return [{ items: [], displayOffset: 0, useFirstBackground: true, showHeader: true, showTotals: true }];
    }

    for (let i = 0; i < allItems.length; i += perPage) {
      const pageItems = allItems.slice(i, i + perPage);
      const isFirst = i === 0;
      const isLast = i + perPage >= allItems.length;
      chunks.push({ items: pageItems, displayOffset: i, useFirstBackground: isFirst, showHeader: isFirst, showTotals: isLast });
    }
    return chunks;
  });

  protected readonly totalPages = computed(() => this.pageChunks().length);

  protected backgroundForPage(pageIndex: number): string | null {
    const snapshot = this.companySnapshot();
    if (!snapshot?.images?.length) return null;
    const context: CompanySnapshotImage['context'] = pageIndex === 0 ? 'kp-page1' : 'kp-page2';
    const found = snapshot.images.find((img) => img.context === context);
    return found?.url || null;
  }

  protected documentFooter(): string {
    return this.companySnapshot()?.footerText?.trim() || '';
  }
}

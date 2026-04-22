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

  protected readonly backgroundUrl1 = '/media/kp/kp-1str.png';
  protected readonly backgroundUrl2 = '/media/kp/kp-2str.png';

  protected readonly totals = computed((): KpTotals => {
    const subtotal = this.items().reduce((s, i) => s + i.price * i.qty, 0);
    const vatAmount = Math.round(subtotal * this.vatPercent() / 100);
    return { subtotal, vatPercent: this.vatPercent(), vatAmount, total: subtotal + vatAmount };
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
}

import { ChangeDetectionStrategy, Component, input, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpBackgroundComponent } from '../kp-background/kp-background.component';
import { KpHeaderComponent, type KpRecipient, type KpMetadata } from '../kp-header/kp-header.component';
import { KpCatalogComponent, type KpCatalogItem, type PriceChangedEvent } from '../kp-catalog/kp-catalog.component';
import { KpTableComponent, type KpTotals } from '../kp-table/kp-table.component';
import { KpTemplatePipe } from '../template-pipe/template.pipe';

interface KpPageChunk {
  items: KpCatalogItem[];
  displayOffset: number;
  useFirstBackground: boolean;
  showHeader: boolean;
  showTotals: boolean;
}

interface CompanySnapshot {
  companyId: string;
  companyName: string;
  templateKey: string;
  templateName: string;
  kpType: 'standard' | 'response' | 'special' | 'tender' | 'service';
  assets: {
    kpPage1: string;
    kpPage2?: string;
    passport?: string;
    appendix?: string;
  };
  texts: {
    headerNote?: string;
    introText?: string;
    footerText?: string;
    closingText?: string;
  };
}

@Component({
  selector: 'app-kp-document',
  standalone: true,
  imports: [
    CommonModule, 
    KpBackgroundComponent, 
    KpHeaderComponent, 
    KpCatalogComponent, 
    KpTableComponent,
    KpTemplatePipe
  ],
  templateUrl: './kp-document.component.html',
  styleUrl: './kp-document.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpDocumentComponent {
  itemsPerPage = input(10);
  firstPageRows = input<number | null | undefined>(null);
  nextPagesRows = input<number | null | undefined>(null);

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
    tablePageBreakFirstPage: 6,
    tablePageBreakNextPages: 6,
    photoScalePercent: 150
  });

  items = input<KpCatalogItem[]>([]);
  editablePrices = input(false);
  conditions = input<string[]>([]);
  vatPercent = input<number>(20);
  companySnapshot = input.required<CompanySnapshot>();
  priceChanged = output<PriceChangedEvent>();

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

  protected readonly resolvedFirstPageRows = computed(() => {
    const explicit = Number(this.firstPageRows());
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, explicit);
    const legacy = Number(this.itemsPerPage());
    return Math.max(1, legacy || 6);
  });

  protected readonly resolvedNextPagesRows = computed(() => {
    const explicit = Number(this.nextPagesRows());
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, explicit);
    const legacy = Number(this.itemsPerPage());
    return Math.max(1, legacy || 6);
  });

  protected readonly pageChunks = computed((): KpPageChunk[] => {
    const chunks: KpPageChunk[] = [];
    const firstPageLimit = this.resolvedFirstPageRows();
    const nextPagesLimit = this.resolvedNextPagesRows();
    const allItems = this.items();
    const minLastPageRows = Math.min(3, nextPagesLimit);

    if (allItems.length === 0) {
      return [{ items: [], displayOffset: 0, useFirstBackground: true, showHeader: true, showTotals: true }];
    }

    let cursor = 0;
    let pageIndex = 0;
    while (cursor < allItems.length) {
      const pageLimit = pageIndex === 0 ? firstPageLimit : nextPagesLimit;
      let chunkSize = Math.min(pageLimit, allItems.length - cursor);
      const remainingAfterChunk = allItems.length - (cursor + chunkSize);
      if (remainingAfterChunk > 0 && remainingAfterChunk < minLastPageRows && chunkSize > 1) {
        const transferToLastPage = minLastPageRows - remainingAfterChunk;
        chunkSize = Math.max(1, chunkSize - transferToLastPage);
      }
      const pageItems = allItems.slice(cursor, cursor + chunkSize);
      const isFirst = pageIndex === 0;
      const isLast = cursor + chunkSize >= allItems.length;
      chunks.push({
        items: pageItems,
        displayOffset: cursor,
        useFirstBackground: isFirst,
        showHeader: isFirst,
        showTotals: isLast
      });
      cursor += chunkSize;
      pageIndex += 1;
    }

    if (globalThis && Boolean((globalThis as Record<string, unknown>)['ngDevMode'])) {
      const details = chunks.map((chunk, index) => `Page ${index + 1}: ${chunk.items.length} rows`).join(', ');
      console.debug(`[KpDocument] Pagination chunks -> ${details}`);
    }

    return chunks;
  });

  protected readonly totalPages = computed(() => this.pageChunks().length);

  protected backgroundForPage(pageIndex: number): string | null {
    const snapshot = this.companySnapshot();
    return pageIndex === 0
      ? (snapshot.assets.kpPage1 || null)
      : (snapshot.assets.kpPage2 || null);
  }

  protected headerNote(): string {
    return String(this.companySnapshot().texts?.headerNote ?? '').trim();
  }

  protected introText(): string {
    return String(this.companySnapshot().texts?.introText ?? '').trim();
  }

  protected closingText(): string {
    return String(this.companySnapshot().texts?.closingText ?? '').trim();
  }

  protected documentFooter(): string {
    return String(this.companySnapshot().texts?.footerText ?? '').trim();
  }
}

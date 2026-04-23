import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpCatalogItem {
  id:          string;
  code?:       string;
  name:        string;
  description: string;
  qty:         number;
  unit:        string;
  price:       number;
  basePrice?:  number;
  adjustmentsLabel?: string;
  imageUrl:    string;
}

export interface PriceChangedEvent {
  itemId: string;
  newPrice: number;
}

@Component({
  selector: 'app-kp-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kp-catalog.component.html',
  styleUrl: './kp-catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpCatalogComponent {
  private static readonly MIN_PHOTO_SIZE_PX = 20;
  private static readonly MAX_PHOTO_SIZE_PX = 160;

  items = input.required<KpCatalogItem[]>();
  editablePrices = input(false);
  showPhotoColumn = input(true);
  showCodeColumn = input(true);
  showDescriptionColumn = input(true);
  vatPercent = input(20);
  displayOffset = input(0); // Смещение для нумерации строк
  photoScalePercent = input(600);
  priceChanged = output<PriceChangedEvent>();
  private readonly brokenImageItemIds = signal(new Set<string>());

  photoSizePx(): number {
    const scale = this.clampPhotoScale(this.photoScalePercent());
    const normalized = scale / 1000; // 0..1
    const clampedNormalized = Math.max(0, Math.min(1, normalized));
    const range = KpCatalogComponent.MAX_PHOTO_SIZE_PX - KpCatalogComponent.MIN_PHOTO_SIZE_PX;
    return Math.round(KpCatalogComponent.MIN_PHOTO_SIZE_PX + range * clampedNormalized);
  }

  photoColWidthPx(): number {
    return this.photoSizePx() + 12;
  }

  hasRenderableImage(item: KpCatalogItem): boolean {
    const url = (item.imageUrl ?? '').trim();
    return url.length > 0 && !this.brokenImageItemIds().has(item.id);
  }

  onImageError(itemId: string): void {
    if (this.brokenImageItemIds().has(itemId)) return;
    const next = new Set(this.brokenImageItemIds());
    next.add(itemId);
    this.brokenImageItemIds.set(next);
  }

  onPriceCommit(event: Event, item: KpCatalogItem): void {
    const input = event.target as HTMLInputElement;
    if (input.dataset['cancelled'] === '1') {
      delete input.dataset['cancelled'];
      return;
    }
    const newPrice = Number.parseFloat(input.value);
    if (!Number.isFinite(newPrice)) {
      input.value = String(item.price);
      return;
    }
    const normalized = Math.max(0, Math.round(newPrice));
    if (normalized === item.price) return;
    this.priceChanged.emit({ itemId: item.id, newPrice: normalized });
  }

  onPriceCancel(event: Event, item: KpCatalogItem): void {
    const input = event.target as HTMLInputElement;
    input.dataset['cancelled'] = '1';
    input.value = String(item.price);
    input.blur();
  }

  private clampPhotoScale(value: number): number {
    const n = Number.isFinite(value) ? value : 600;
    return Math.min(1000, Math.max(0, n));
  }
}
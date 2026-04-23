import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
  items = input.required<KpCatalogItem[]>();
  editablePrices = input(false);
  showPhotoColumn = input(true);
  showCodeColumn = input(true);
  showDescriptionColumn = input(true);
  vatPercent = input(20);
  displayOffset = input(0); // Смещение для нумерации строк
  photoScalePercent = input(150);
  priceChanged = output<PriceChangedEvent>();

  photoSizePx(): number {
    const scale = this.clampPhotoScale(this.photoScalePercent());
    return Math.round(46 * scale / 100);
  }

  photoColWidthPx(): number {
    return this.photoSizePx() + 14;
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
    const n = Number.isFinite(value) ? value : 150;
    return Math.min(350, Math.max(150, n));
  }
}
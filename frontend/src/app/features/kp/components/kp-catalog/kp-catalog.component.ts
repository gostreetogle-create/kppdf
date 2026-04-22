import { Component, input } from '@angular/core';
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

@Component({
  selector: 'app-kp-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kp-catalog.component.html',
  styleUrl: './kp-catalog.component.scss'
})
export class KpCatalogComponent {
  items = input.required<KpCatalogItem[]>();
  showPhotoColumn = input(true);
  showCodeColumn = input(true);
  showDescriptionColumn = input(true);
  vatPercent = input(20);
  displayOffset = input(0); // Смещение для нумерации строк
  photoScalePercent = input(150);

  photoSizePx(): number {
    const scale = this.clampPhotoScale(this.photoScalePercent());
    return Math.round(46 * scale / 100);
  }

  photoColWidthPx(): number {
    return this.photoSizePx() + 14;
  }

  private clampPhotoScale(value: number): number {
    const n = Number.isFinite(value) ? value : 150;
    return Math.min(350, Math.max(150, n));
  }
}
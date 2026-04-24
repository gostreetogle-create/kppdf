import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../core/services/api.service';

@Component({
  selector: 'app-kp-catalog-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kp-catalog-item.component.html',
  styleUrl: './kp-catalog-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpCatalogItemComponent {
  product = input.required<Product>();
  isSelected = input(false);
  onAdd = output<Product>();

  productImageUrl(): string | null {
    const image = this.product().images.find(i => i.isMain) ?? this.product().images[0];
    const raw = image?.url?.trim();
    if (!raw) return null;
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    const normalized = raw.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (normalized.startsWith('media/')) return `/${normalized}`;
    if (normalized.startsWith('products/')) return `/media/${normalized}`;
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }
}

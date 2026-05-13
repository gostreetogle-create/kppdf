import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../core/services/api.service';
import { normalizeImageUrl } from '../../../../shared/utils/image.utils';

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
  onDuplicate = output<Product>();

  productImageUrl(): string | null {
    const url = normalizeImageUrl(this.product().images);
    return url === '/kp-1str.png' ? null : url;
  }
}

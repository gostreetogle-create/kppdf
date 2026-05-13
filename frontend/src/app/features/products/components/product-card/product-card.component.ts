import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { normalizeImageUrl } from '../../../../shared/utils/image.utils';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  product = input.required<Product>();
  edit = output<void>();
  duplicate = output<void>();
  passport = output<void>();
  delete = output<void>();

  get mainImage(): string {
    return normalizeImageUrl(this.product().images);
  }

  get kindLabel(): string {
    return { ITEM: 'Товар', SERVICE: 'Услуга', WORK: 'Работа' }[this.product().kind] ?? '';
  }
}

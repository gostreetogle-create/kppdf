import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent {
  product = input.required<Product>();
  edit    = output<void>();
  duplicate = output<void>();
  passport = output<void>();
  delete  = output<void>();

  get mainImage(): string {
    const images = this.product().images;
    if (!images?.length) return '/media/kp/kp-1str.png';
    return images.find(i => i.isMain)?.url ?? images[0].url;
  }

  get kindLabel(): string {
    return { ITEM: 'Товар', SERVICE: 'Услуга', WORK: 'Работа' }[this.product().kind] ?? '';
  }
}

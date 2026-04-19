import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpCatalogComponent, type KpCatalogItem } from '../../kp/components/kp-catalog/kp-catalog.component';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [CommonModule, KpCatalogComponent],
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent {
  protected readonly products: KpCatalogItem[] = [
    {
      id: 1,
      name: 'Металлоконструкция стальная',
      description: 'Изготовление по чертежам заказчика, сталь 09Г2С',
      qty: 1,
      unit: 'шт.',
      price: 25000,
      imageUrl: '/kp/kp-1str.png'
    },
    {
      id: 2,
      name: 'Покраска порошковая',
      description: 'RAL 7024, полимерное покрытие',
      qty: 1,
      unit: 'м²',
      price: 500,
      imageUrl: '/kp/kp-2str.png'
    },
    {
      id: 3,
      name: 'Сварочные работы',
      description: 'Сварка полуавтоматом в среде защитных газов',
      qty: 1,
      unit: 'м.п.',
      price: 800,
      imageUrl: '/kp/kp-1str.png'
    }
  ];
}

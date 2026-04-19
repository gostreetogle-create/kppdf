import { Component } from '@angular/core';
import {CommonModule, DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe
  ],
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent {
  products = [
    { id: 1, name: 'Ноутбук Lenovo', price: 45900, unit: 'шт' },
    { id: 2, name: 'Монитор 27"', price: 18900, unit: 'шт' },
    { id: 3, name: 'Клавиатура механическая', price: 4500, unit: 'шт' },
  ];
}

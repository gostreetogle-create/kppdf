import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {ProductCatalogComponent} from '../../products/catalog/product-catalog.component';
import {KpDocumentComponent} from '../components/kp-document/kp-document.component';

@Component({
  selector: 'app-kp-builder',
  standalone: true,
  imports: [
    ProductCatalogComponent, CommonModule, KpDocumentComponent
  ],
  templateUrl: './kp-builder.component.html',
  styleUrl: './kp-builder.component.scss'
})
export class KpBuilderComponent {
  // Сигналы — это современный способ работы с данными в Angular 17+
  products = signal<any[]>([]);

  saveOffer() {
    console.log('Сохраняем КП...');
    // Потом сюда подключим сервис
  }

  print() {
    window.print();
  }
}

import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpCatalogItem {
  id: number;
  name: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  imageUrl: string;
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
  showDescriptionColumn = input(true);
  displayOffset = input(0); // Смещение для нумерации строк
}
import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { ProductSpecGroup } from '../../../../core/services/api.service';

@Component({
  selector: 'app-product-spec-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-spec-viewer.component.html',
  styleUrl: './product-spec-viewer.component.scss'
})
export class ProductSpecViewerComponent {
  groups = input<ProductSpecGroup[]>([]);
}

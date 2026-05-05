import { Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { KpItem } from '../../../../../core/services/api.service';

@Component({
  selector: 'app-kp-cart-item',
  standalone: true,
  imports: [CommonModule, CdkDrag, CdkDragHandle],
  templateUrl: './kp-cart-item.component.html',
  styleUrls: ['./kp-cart-item.component.scss'],
})
export class KpCartItemComponent {
  item = input.required<KpItem>();
  isSelected = input.required<boolean>();
  isReadOnly = input.required<boolean>();
  itemUnitPrice = input.required<number>();
  imageUrl = input.required<string | null>();

  selectionChange = output<boolean>();
  qtyChange = output<number>();
  decrement = output<void>();
  increment = output<void>();
  edit = output<void>();
  duplicate = output<void>();
  remove = output<void>();
}

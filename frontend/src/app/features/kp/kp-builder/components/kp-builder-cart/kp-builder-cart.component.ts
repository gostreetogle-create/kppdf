import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { KpItem } from '../../../../../core/services/api.service';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-kp-builder-cart',
  standalone: true,
  imports: [CommonModule, DragDropModule, ButtonComponent],
  templateUrl: './kp-builder-cart.component.html',
  styleUrls: ['../../kp-builder.sidebar.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpBuilderCartComponent {
  collapsed = input(true);
  isReadOnly = input(false);
  items = input<KpItem[]>([]);
  selectedItemIds = input<string[]>([]);
  bulkMarkupPercent = input(0);
  bulkDiscountPercent = input(0);
  vatPercent = input(20);
  total = input(0);
  lastRemovedItem = input<KpItem | null>(null);
  imageUrlResolver = input<(url?: string) => string>(() => '');
  itemUnitPriceResolver = input<(item: KpItem) => number>(() => 0);

  toggleCollapsed = output<void>();
  openCreateProduct = output<void>();
  reorder = output<CdkDragDrop<KpItem[]>>();
  itemSelectionChange = output<{ item: KpItem; checked: boolean }>();
  qtyChange = output<{ item: KpItem; qty: number }>();
  incrementQty = output<KpItem>();
  decrementQty = output<KpItem>();
  removeItem = output<KpItem>();
  bulkMarkupInput = output<string | number>();
  bulkDiscountInput = output<string | number>();
  clearBulkAdjustments = output<void>();
  undoRemoveItem = output<void>();
}

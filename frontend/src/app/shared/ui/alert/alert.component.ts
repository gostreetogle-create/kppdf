import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'error' | 'success' | 'warning' | 'info';

@Component({
  selector: 'ui-alert',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content />`,
  styleUrl: './alert.component.scss',
  host: { '[class]': '"alert alert--" + type()' }
})
export class AlertComponent {
  type = input<AlertType>('error');
}

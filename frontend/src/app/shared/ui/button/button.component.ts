import { Component, input, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'button[ui-btn], a[ui-btn]',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content />`,
  styleUrl: './button.component.scss',
  host: {
    '[class]': '"btn ui-btn btn--" + variant() + " ui-btn--" + variant() + " btn--" + size() + " ui-btn--" + size()',
    '[class.btn--icon]': 'icon()',
    '[class.ui-btn--icon]': 'icon()',
  }
})
export class ButtonComponent {
  variant = input<ButtonVariant>('default');
  size    = input<ButtonSize>('md');
  icon    = input(false, { transform: booleanAttribute });
}

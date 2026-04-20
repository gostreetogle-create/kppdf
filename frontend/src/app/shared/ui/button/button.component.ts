import { Component, input, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'button[ui-btn], a[ui-btn]',
  standalone: true,
  imports: [CommonModule],
  template: `<ng-content />`,
  styleUrl: './button.component.scss',
  host: {
    '[class]': '"btn btn--" + variant() + " btn--" + size()',
    '[class.btn--icon]': 'icon()',
  }
})
export class ButtonComponent {
  variant = input<ButtonVariant>('default');
  size    = input<ButtonSize>('md');
  icon    = input(false, { transform: booleanAttribute });
}

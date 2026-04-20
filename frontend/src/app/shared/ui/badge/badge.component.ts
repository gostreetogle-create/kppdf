import { Component, input } from '@angular/core';

export type BadgeColor = 'default' | 'blue' | 'green' | 'red' | 'orange';

@Component({
  selector: 'ui-badge',
  standalone: true,
  template: `<ng-content />`,
  styleUrl: './badge.component.scss',
  host: { '[class]': '"badge badge--" + color()' }
})
export class BadgeComponent {
  color = input<BadgeColor>('default');
}

import { Component, input, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardTone = 'default' | 'muted';

@Component({
  selector: 'ui-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  host: {
    class: 'ui-card',
    '[class.ui-card--muted]': "tone() === 'muted'",
    '[class.ui-card--interactive]': 'interactive()'
  }
})
export class CardComponent {
  tone = input<CardTone>('default');
  interactive = input(false, { transform: booleanAttribute });
}

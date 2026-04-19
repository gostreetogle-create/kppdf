import { Component, input } from '@angular/core';

@Component({
  selector: 'app-kp-background',
  standalone: true,
  templateUrl: './kp-background.component.html',
  styleUrl: './kp-background.component.scss'
})
export class KpBackgroundComponent {
  /** Можно передать любой фон */
  imageUrl = input.required<string>();
}

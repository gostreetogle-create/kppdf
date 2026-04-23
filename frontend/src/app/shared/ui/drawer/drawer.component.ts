import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'ui-drawer',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.scss'
})
export class DrawerComponent {
  title = input('');
  width = input('min(980px, 92vw)');
  closeOnBackdrop = input(true);
  closed = output<void>();

  onBackdropClick(event: MouseEvent) {
    if (!this.closeOnBackdrop()) return;
    if ((event.target as HTMLElement).classList.contains('drawer-backdrop')) {
      this.closed.emit();
    }
  }
}

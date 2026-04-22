import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent {
  title    = input('');
  maxWidth = input('540px');
  closeOnBackdrop = input(true);
  closed   = output<void>();

  onBackdrop(e: MouseEvent) {
    if (this.closeOnBackdrop() && (e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closed.emit();
    }
  }
}

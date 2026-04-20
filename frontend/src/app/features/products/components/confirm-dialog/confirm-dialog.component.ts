import { Component, input, output } from '@angular/core';
import { ModalComponent, ButtonComponent } from '../../../../shared/ui/index';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  title     = input('Подтвердите действие');
  message   = input('');
  confirmed = output<void>();
  cancelled = output<void>();
}

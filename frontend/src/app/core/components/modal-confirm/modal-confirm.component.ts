import { Component, inject } from '@angular/core';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-modal-confirm',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  templateUrl: './modal-confirm.component.html',
  styleUrl: './modal-confirm.component.scss'
})
export class ModalConfirmComponent {
  readonly modal = inject(ModalService);

  confirm(): void {
    this.modal.resolveConfirm(true);
  }

  cancel(): void {
    this.modal.resolveConfirm(false);
  }
}

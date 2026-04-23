import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent {
  readonly ns = inject(NotificationService);

  dismissToast(id: number, event?: MouseEvent): void {
    event?.stopPropagation();
    this.ns.dismiss(id);
  }
}

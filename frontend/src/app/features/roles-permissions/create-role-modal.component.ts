import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Role } from '../../core/services/api.service';
import { ButtonComponent } from '../../shared/ui';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-create-role-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalComponent],
  templateUrl: './create-role-modal.component.html',
  styleUrl: './create-role-modal.component.scss'
})
export class CreateRoleModalComponent {
  open = input(false);
  roles = input<Role[]>([]);
  submitting = input(false);
  initialCopyFromRoleId = input<string | null>(null);

  close = output<void>();
  submitRole = output<{ name: string; copyFromRoleId?: string }>();

  readonly name = signal('');
  readonly copyFromRoleId = signal('');
  readonly canSubmit = computed(() => this.name().trim().length > 0 && !this.submitting());

  syncInitial(): void {
    const initial = this.initialCopyFromRoleId();
    this.copyFromRoleId.set(initial ?? '');
  }

  onSubmit(): void {
    const name = this.name().trim();
    if (!name) return;
    const copyFromRoleId = this.copyFromRoleId().trim();
    this.submitRole.emit({
      name,
      copyFromRoleId: copyFromRoleId || undefined
    });
  }

  onClose(): void {
    this.name.set('');
    this.copyFromRoleId.set('');
    this.close.emit();
  }
}

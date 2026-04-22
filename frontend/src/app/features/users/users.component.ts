import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, type AppUser, type AppUserRole } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/ui';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  private readonly api = inject(ApiService);
  private readonly ns = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly users = signal<AppUser[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);

  readonly createModel = signal({
    username: '',
    name: '',
    role: 'manager' as AppUserRole,
    password: ''
  });

  readonly resetPasswordDraft = signal<Record<string, string>>({});

  constructor() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.api.getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => {
          this.users.set(users);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.ns.error('Не удалось загрузить пользователей');
        }
      });
  }

  createUser() {
    const model = this.createModel();
    if (!model.username || !model.name || !model.password) {
      this.ns.error('Заполните логин, имя и пароль');
      return;
    }
    this.busy.set(true);
    this.api.createUser(model)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.createModel.set({ username: '', name: '', role: 'manager', password: '' });
          this.ns.success('Пользователь создан');
          this.loadUsers();
        },
        error: err => {
          this.busy.set(false);
          this.ns.error(err.error?.message ?? 'Ошибка создания пользователя');
        }
      });
  }

  updateUser(user: AppUser, patch: Partial<Pick<AppUser, 'role' | 'isActive'>>) {
    this.api.updateUser(user._id, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.users.update(list => list.map(u => (u._id === updated._id ? updated : u)));
          this.ns.success('Пользователь обновлён');
        },
        error: err => this.ns.error(err.error?.message ?? 'Ошибка обновления пользователя')
      });
  }

  setResetPasswordDraft(userId: string, password: string) {
    this.resetPasswordDraft.update(state => ({ ...state, [userId]: password }));
  }

  resetPassword(user: AppUser) {
    const password = this.resetPasswordDraft()[user._id];
    if (!password) {
      this.ns.error('Введите новый пароль');
      return;
    }
    this.api.resetUserPassword(user._id, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.setResetPasswordDraft(user._id, '');
          this.ns.success('Пароль сброшен');
          this.loadUsers();
        },
        error: err => this.ns.error(err.error?.message ?? 'Ошибка сброса пароля')
      });
  }
}


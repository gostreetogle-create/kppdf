import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, type AppUser, type Role } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent, StatusBadgeComponent } from '../../shared/ui';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, StatusBadgeComponent, ModalComponent],
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
  readonly savingUserId = signal<string | null>(null);
  readonly roles = signal<Role[]>([]);

  readonly createModel = signal({
    username: '',
    name: '',
    roleId: '',
    password: ''
  });

  readonly editDraft = signal<Record<string, { username: string; name: string; roleId: string | null; isActive: boolean }>>({});
  readonly deletingUser = signal<AppUser | null>(null);
  readonly openActionsForUserId = signal<string | null>(null);
  readonly resettingUser = signal<AppUser | null>(null);
  readonly resetPasswordValue = signal('');

  constructor() {
    this.loadRoles();
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);
    this.api.getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => {
          this.users.set(users);
          this.editDraft.set(
            Object.fromEntries(
              users.map(user => [
                user._id,
                { username: user.username, name: user.name, roleId: user.roleId, isActive: user.isActive }
              ])
            )
          );
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
    const username = model.username.trim().toLowerCase();
    const name = model.name.trim();
    const password = model.password.trim();

    if (!username || !name || !password) {
      this.ns.error('Заполните логин, имя и пароль');
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      this.ns.error('Логин: 3-32 символа, только латиница/цифры/._-');
      return;
    }
    if (password.length < 8) {
      this.ns.error('Пароль должен быть не короче 8 символов');
      return;
    }
    const alreadyExists = this.users().some(user => String(user.username ?? '').toLowerCase() === username);
    if (alreadyExists) {
      this.ns.error(`Пользователь с логином "${username}" уже существует`);
      return;
    }

    if (!model.roleId) {
      this.ns.error('Выберите роль');
      return;
    }

    this.busy.set(true);
    this.api.createUser({
      username,
      name,
      roleId: model.roleId,
      password
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.createModel.set({
            username: '',
            name: '',
            roleId: this.defaultRoleId(),
            password: ''
          });
          this.ns.success('Пользователь создан');
          this.loadUsers();
        },
        error: err => {
          this.busy.set(false);
          this.ns.error(err.error?.message ?? 'Ошибка создания пользователя');
        }
      });
  }

  setEditDraft(userId: string, patch: Partial<{ username: string; name: string; roleId: string | null; isActive: boolean }>) {
    this.editDraft.update(state => ({
      ...state,
      [userId]: { ...state[userId], ...patch }
    }));
  }

  saveUser(user: AppUser) {
    const draft = this.editDraft()[user._id];
    const username = draft?.username?.trim().toLowerCase() ?? '';
    if (!username) {
      this.ns.error('Логин пользователя не может быть пустым');
      return;
    }
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      this.ns.error('Логин: 3-32 символа, только латиница/цифры/._-');
      return;
    }
    const duplicate = this.users().some(item => item._id !== user._id && String(item.username ?? '').toLowerCase() === username);
    if (duplicate) {
      this.ns.error(`Пользователь с логином "${username}" уже существует`);
      return;
    }
    if (!draft?.name?.trim()) {
      this.ns.error('Имя пользователя не может быть пустым');
      return;
    }
    this.savingUserId.set(user._id);
    this.api.updateUser(user._id, {
      username,
      name: draft.name.trim(),
      roleId: draft.roleId ?? undefined,
      isActive: draft.isActive
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.users.update(list => list.map(u => (u._id === updated._id ? updated : u)));
          this.savingUserId.set(null);
          this.ns.success('Пользователь обновлён');
        },
        error: err => {
          this.savingUserId.set(null);
          this.ns.error(err.error?.message ?? 'Ошибка обновления пользователя');
        }
      });
  }

  openResetPassword(user: AppUser) {
    this.closeActionsMenu();
    this.resettingUser.set(user);
    this.resetPasswordValue.set('');
  }

  closeResetPasswordModal() {
    this.resettingUser.set(null);
    this.resetPasswordValue.set('');
  }

  resetPassword() {
    const user = this.resettingUser();
    if (!user) return;
    const password = this.resetPasswordValue().trim();
    if (!password) {
      this.ns.error('Введите новый пароль');
      return;
    }
    this.api.resetUserPassword(user._id, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeResetPasswordModal();
          this.ns.success('Пароль сброшен');
          this.loadUsers();
        },
        error: err => this.ns.error(err.error?.message ?? 'Ошибка сброса пароля')
      });
  }

  confirmDelete(user: AppUser) {
    this.closeActionsMenu();
    this.deletingUser.set(user);
  }

  closeDeleteModal() {
    this.deletingUser.set(null);
  }

  deleteUser() {
    const user = this.deletingUser();
    if (!user) return;
    this.api.deleteUser(user._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeDeleteModal();
          this.users.update(list => list.filter(item => item._id !== user._id));
          this.ns.success('Пользователь удалён');
        },
        error: err => this.ns.error(err.error?.message ?? 'Ошибка удаления пользователя')
      });
  }

  toggleActionsMenu(userId: string) {
    this.openActionsForUserId.update(current => (current === userId ? null : userId));
  }

  closeActionsMenu() {
    this.openActionsForUserId.set(null);
  }

  roleNameById(roleId: string | null): string {
    if (!roleId) return '—';
    return this.roles().find(r => r._id === roleId)?.name ?? '—';
  }

  private loadRoles() {
    this.api.getRoles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (roles) => {
          this.roles.set(roles);
          if (!this.createModel().roleId) {
            this.createModel.update(model => ({ ...model, roleId: this.defaultRoleId() }));
          }
        },
        error: () => this.ns.error('Не удалось загрузить роли')
      });
  }

  private defaultRoleId(): string {
    const managerRole = this.roles().find(role => role.key === 'manager');
    return managerRole?._id ?? this.roles()[0]?._id ?? '';
  }
}


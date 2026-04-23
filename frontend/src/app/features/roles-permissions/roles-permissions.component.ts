import { ChangeDetectorRef, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ApiService,
  type PermissionDefinition,
  type PermissionModule,
  type Role
} from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ModalService } from '../../core/services/modal.service';
import { ButtonComponent } from '../../shared/ui';
import { PermissionGroupComponent } from './permission-group.component';
import { CreateRoleModalComponent } from './create-role-modal.component';

const MODULE_TITLES: Record<PermissionModule, string> = {
  kp: 'Коммерческие предложения',
  products: 'Товары',
  counterparties: 'Контрагенты',
  users: 'Пользователи',
  settings: 'Настройки',
  backups: 'Бэкапы'
};

@Component({
  selector: 'app-roles-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    PermissionGroupComponent,
    CreateRoleModalComponent
  ],
  templateUrl: './roles-permissions.component.html',
  styleUrl: './roles-permissions.component.scss'
})
export class RolesPermissionsComponent {
  private readonly api = inject(ApiService);
  private readonly ns = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly creatingRole = signal(false);
  readonly guestLinkLoading = signal(false);
  readonly roles = signal<Role[]>([]);
  readonly permissions = signal<PermissionDefinition[]>([]);
  readonly selectedRoleId = signal<string | null>(null);
  readonly originalPermissionsMap = signal<Map<string, Set<string>>>(new Map());
  readonly editedPermissionsMap = signal<Map<string, Set<string>>>(new Map());
  readonly dirtyRoleIds = signal<Set<string>>(new Set());
  readonly editingRoleId = signal<string | null>(null);
  readonly editingRoleName = signal('');
  readonly createRoleModalOpen = signal(false);
  readonly createRoleCopyFromId = signal<string | null>(null);

  readonly selectedRole = computed(() => this.roles().find(role => role._id === this.selectedRoleId()) ?? null);
  readonly hasDirtyChanges = computed(() => this.dirtyRoleIds().size > 0);
  readonly canEditSelectedRolePermissions = computed(() => {
    const role = this.selectedRole();
    if (!role) return false;
    if (!role.isSystem) return true;
    return !['owner', 'admin'].includes(role.key);
  });
  readonly permissionsByModule = computed(() => {
    const grouped = new Map<PermissionModule, PermissionDefinition[]>();
    for (const permission of this.permissions()) {
      const current = grouped.get(permission.module) ?? [];
      current.push(permission);
      grouped.set(permission.module, current);
    }
    return Array.from(grouped.entries()).map(([module, items]) => ({
      module,
      title: MODULE_TITLES[module],
      items
    }));
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    combineLatest([this.api.getRoles(), this.api.getPermissions()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([roles, permissions]) => {
          this.roles.set(roles);
          this.permissions.set(permissions);
          if (!this.selectedRoleId() && roles.length > 0) this.selectedRoleId.set(roles[0]._id);
          if (this.selectedRoleId() && !roles.some(role => role._id === this.selectedRoleId())) {
            this.selectedRoleId.set(roles[0]?._id ?? null);
          }
          this.rebuildPermissionMaps(roles);
          this.loading.set(false);
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading.set(false);
          this.ns.error('Не удалось загрузить роли и полномочия');
        }
      });
  }

  selectRole(roleId: string): void {
    this.selectedRoleId.set(roleId);
  }

  selectedPermissions(): Set<string> {
    const roleId = this.selectedRoleId();
    if (!roleId) return new Set();
    return this.editedPermissionsMap().get(roleId) ?? new Set();
  }

  togglePermission(permissionKey: string, checked: boolean): void {
    const role = this.selectedRole();
    if (!role || !this.canEditSelectedRolePermissions()) return;

    this.editedPermissionsMap.update(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(role._id) ?? []);
      if (checked) set.add(permissionKey);
      else set.delete(permissionKey);
      next.set(role._id, set);
      return next;
    });
    this.updateRoleDirty(role._id);
  }

  openCreateRoleModal(copyFromRoleId?: string): void {
    this.createRoleCopyFromId.set(copyFromRoleId ?? null);
    this.createRoleModalOpen.set(true);
  }

  closeCreateRoleModal(): void {
    this.createRoleModalOpen.set(false);
    this.createRoleCopyFromId.set(null);
  }

  createRole(payload: { name: string; copyFromRoleId?: string }): void {
    this.creatingRole.set(true);
    this.api.createRole(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (role) => {
          this.creatingRole.set(false);
          this.closeCreateRoleModal();
          this.roles.update(list => [...list, role].sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name)));
          this.selectedRoleId.set(role._id);
          this.rebuildPermissionMaps(this.roles());
          this.ns.success('Роль создана');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.creatingRole.set(false);
          this.ns.error(err?.error?.message ?? 'Не удалось создать роль');
        }
      });
  }

  startRename(role: Role): void {
    this.editingRoleId.set(role._id);
    this.editingRoleName.set(role.name);
  }

  cancelRename(): void {
    this.editingRoleId.set(null);
    this.editingRoleName.set('');
  }

  commitRename(role: Role): void {
    const nextName = this.editingRoleName().trim();
    if (!nextName || nextName === role.name) {
      this.cancelRename();
      return;
    }
    this.api.updateRoleName(role._id, nextName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.roles.update(list => list.map(item => item._id === role._id ? updated : item));
          this.cancelRename();
          this.ns.success('Название роли обновлено');
          this.cdr.detectChanges();
        },
        error: (err) => this.ns.error(err?.error?.message ?? 'Не удалось обновить название роли')
      });
  }

  async deleteRole(role: Role): Promise<void> {
    const confirmed = await firstValueFrom(this.modal.confirm({
      title: 'Удалить роль',
      message: `Роль "${role.name}" будет удалена. Пользователи этой роли будут переназначены на "manager".`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    }));
    if (!confirmed) return;

    this.api.deleteRole(role._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.roles.update(list => list.filter(item => item._id !== role._id));
          if (this.selectedRoleId() === role._id) {
            this.selectedRoleId.set(this.roles()[0]?._id ?? null);
          }
          this.rebuildPermissionMaps(this.roles());
          this.ns.success('Роль удалена');
          this.cdr.detectChanges();
        },
        error: (err) => this.ns.error(err?.error?.message ?? 'Не удалось удалить роль')
      });
  }

  async savePermissionChanges(): Promise<void> {
    const roleIds = Array.from(this.dirtyRoleIds());
    if (roleIds.length === 0) return;
    this.saving.set(true);
    try {
      for (const roleId of roleIds) {
        const role = this.roles().find(item => item._id === roleId);
        if (!role) continue;
        const permissions = Array.from(this.editedPermissionsMap().get(roleId) ?? []);
        const updated = await firstValueFrom(this.api.updateRolePermissions(roleId, permissions));
        this.roles.update(list => list.map(item => item._id === roleId ? updated : item));
      }
      this.rebuildPermissionMaps(this.roles());
      this.dirtyRoleIds.set(new Set());
      this.ns.success('Изменения прав сохранены');
      this.cdr.detectChanges();
    } catch (err: any) {
      this.ns.error(err?.error?.message ?? 'Не удалось сохранить изменения прав');
    } finally {
      this.saving.set(false);
    }
  }

  generateGuestLink(): void {
    if (this.guestLinkLoading()) return;
    this.guestLinkLoading.set(true);
    this.api.issueGuestPreviewLink(7)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async ({ previewUrl }) => {
          this.guestLinkLoading.set(false);
          const copied = await this.copyToClipboard(previewUrl);
          if (copied) {
            this.ns.success('Гостевая ссылка скопирована в буфер');
          } else {
            this.ns.success(`Гостевая ссылка: ${previewUrl}`);
          }
        },
        error: (err) => {
          this.guestLinkLoading.set(false);
          this.ns.error(err?.error?.message ?? 'Не удалось сгенерировать гостевую ссылку');
        }
      });
  }

  cancelPermissionChanges(): void {
    this.editedPermissionsMap.set(this.clonePermissionMap(this.originalPermissionsMap()));
    this.dirtyRoleIds.set(new Set());
  }

  roleIsDirty(roleId: string): boolean {
    return this.dirtyRoleIds().has(roleId);
  }

  private rebuildPermissionMaps(roles: Role[]): void {
    const original = new Map<string, Set<string>>();
    const edited = new Map<string, Set<string>>();
    for (const role of roles) {
      const permissions = new Set(role.permissions ?? []);
      original.set(role._id, new Set(permissions));
      edited.set(role._id, new Set(permissions));
    }
    this.originalPermissionsMap.set(original);
    this.editedPermissionsMap.set(edited);
    this.dirtyRoleIds.set(new Set());
  }

  private clonePermissionMap(input: Map<string, Set<string>>): Map<string, Set<string>> {
    const next = new Map<string, Set<string>>();
    for (const [roleId, set] of input.entries()) next.set(roleId, new Set(set));
    return next;
  }

  private updateRoleDirty(roleId: string): void {
    const original = this.originalPermissionsMap().get(roleId) ?? new Set<string>();
    const edited = this.editedPermissionsMap().get(roleId) ?? new Set<string>();
    const changed = !this.setsEqual(original, edited);
    this.dirtyRoleIds.update(prev => {
      const next = new Set(prev);
      if (changed) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  }

  private setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  private async copyToClipboard(value: string): Promise<boolean> {
    if (!navigator?.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }
}

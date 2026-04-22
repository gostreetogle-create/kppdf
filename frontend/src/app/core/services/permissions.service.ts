import { Injectable, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import type { AuthUser, Permission } from '../../../../../shared/types/User';

const ROLE_PERMISSIONS: Record<AuthUser['role'], Permission[]> = {
  owner: [
    'kp.create', 'kp.edit', 'kp.delete', 'kp.view',
    'products.write', 'products.view',
    'counterparties.crud',
    'settings.write',
    'backups.manage',
    'users.manage'
  ],
  admin: [
    'kp.create', 'kp.edit', 'kp.delete', 'kp.view',
    'products.write', 'products.view',
    'counterparties.crud',
    'settings.write',
    'backups.manage',
    'users.manage'
  ],
  manager: ['kp.create', 'kp.edit', 'kp.view', 'products.view', 'counterparties.crud'],
  viewer: ['kp.view', 'products.view']
};

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);
  readonly currentUser = this.auth.currentUser;
  readonly currentUser$ = toObservable(this.currentUser);
  readonly permissions = computed(() => {
    const user = this.currentUser();
    if (!user || !user.isActive) return [] as Permission[];
    return ROLE_PERMISSIONS[user.role] ?? [];
  });

  can(permission: Permission): boolean {
    return this.permissions().includes(permission);
  }
}


import { Injectable, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import type { AuthUser, Permission } from '../../../../../shared/types/User';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);
  readonly currentUser = this.auth.currentUser;
  readonly currentUser$ = toObservable(this.currentUser);
  readonly permissions = computed(() => {
    const user = this.currentUser();
    if (!user || !user.isActive) return [] as Permission[];
    return user.permissions ?? [];
  });

  can(permission: Permission): boolean {
    return this.permissions().includes(permission);
  }
}


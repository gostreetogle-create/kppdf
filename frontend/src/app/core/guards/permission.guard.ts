import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';
import type { Permission } from '../../../../../shared/types/User';

export const permissionGuard: CanActivateFn = route => {
  const permission = route.data?.['permission'] as Permission | undefined;
  const permissions = inject(PermissionsService);
  const router = inject(Router);

  if (!permission) return true;
  if (permissions.can(permission)) return true;
  return router.parseUrl('/');
};


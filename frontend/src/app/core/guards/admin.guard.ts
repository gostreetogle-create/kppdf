import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionsService } from '../services/permissions.service';

export const adminGuard: CanActivateFn = () => {
  const permissions = inject(PermissionsService);
  const router = inject(Router);

  if (permissions.can('settings.write')) return true;
  router.navigate(['/']);
  return false;
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // APP_INITIALIZER гарантирует что authReady=true к моменту вызова guard.
  // Эта проверка — страховка на случай прямого вызова guard без APP_INITIALIZER.
  if (!auth.authReady()) {
    return router.parseUrl('/login');
  }

  if (auth.isAuthenticated()) return true;

  return router.parseUrl('/login');
};

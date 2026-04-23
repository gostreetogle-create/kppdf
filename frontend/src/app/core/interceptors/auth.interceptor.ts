import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const token  = auth.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError(err => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const url = req.url;
        // Не вмешиваемся в 401 с «публичных» auth-запросов: иначе цикл
        // (logout без токена → 401 → снова logout) или бесконечный retry логина.
        const skipRefreshAndLogout =
          url.includes('/auth/login') || url.includes('/auth/logout') || url.includes('/guest/enter/');
        if (skipRefreshAndLogout) {
          return throwError(() => err);
        }

        const isAuthRefreshCall = url.includes('/auth/refresh');
        if (isAuthRefreshCall) {
          auth.logout();
          router.navigate(['/login']);
          return throwError(() => err);
        }
        return from(auth.tryRefresh()).pipe(
          switchMap(ok => {
            if (!ok) {
              auth.logout();
              router.navigate(['/login']);
              return throwError(() => err);
            }
            const nextToken = auth.token();
            const retriedReq = nextToken
              ? req.clone({ setHeaders: { Authorization: `Bearer ${nextToken}` } })
              : req;
            return next(retriedReq);
          })
        );
      }
      return throwError(() => err);
    })
  );
};

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
        const isAuthRefreshCall = req.url.includes('/api/auth/refresh');
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

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const ns     = inject(NotificationService);
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
      if (err instanceof HttpErrorResponse && shouldNotifyError(req, err)) {
        ns.error(getErrorMessage(err));
      }
      return throwError(() => err);
    })
  );
};

function getErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 400) {
    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }
    return 'Проверьте корректность введённых данных';
  }
  if (error.status === 404) return 'Ресурс не найден';
  if (error.status >= 500) return 'Сервис временно недоступен. Попробуйте позже';
  if (error.status === 0) return 'Сервер недоступен. Проверьте сеть и повторите попытку';
  if (typeof error.error?.message === 'string' && error.error.message.trim()) return error.error.message;
  return 'Произошла непредвиденная ошибка';
}

function shouldNotifyError(req: { url: string; headers: { has: (key: string) => boolean } }, error: HttpErrorResponse): boolean {
  if (req.headers.has('X-Silent-Error')) return false;
  if (req.url.includes('/settings/backups/download/')) return false;
  if (error.status === 401) return false;
  return true;
}

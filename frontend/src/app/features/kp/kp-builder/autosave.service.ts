import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription, merge, timer, EMPTY } from 'rxjs';
import { switchMap, take, catchError, tap } from 'rxjs/operators';
import { ApiService, Kp } from '../../../core/services/api.service';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

@Injectable()
export class AutosaveService implements OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly trigger$ = new Subject<Kp>();
  private readonly flush$   = new Subject<void>();
  private readonly sub: Subscription;

  // Signal для реактивного отображения в шаблоне
  readonly status = signal<SaveStatus>('saved');

  constructor() {
    this.sub = this.trigger$
      .pipe(
        switchMap(kp =>
          merge(timer(2000), this.flush$)
            .pipe(
              take(1),
              tap(() => this.status.set('saving')),
              switchMap(() => this.api.updateKp(kp._id, kp)),
              tap(() => this.status.set('saved')),
              catchError(() => {
                this.status.set('error');
                return EMPTY;
              })
            )
        )
      )
      .subscribe();
  }

  /** Запустить дебаунс-таймер */
  schedule(kp: Kp): void {
    this.status.set('unsaved');
    this.trigger$.next(kp);
  }

  /** Немедленное сохранение */
  saveNow(kp: Kp): void {
    this.status.set('saving');
    this.trigger$.next(kp);
    this.flush$.next();
  }

  get isDirty(): boolean {
    return this.status() === 'unsaved';
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

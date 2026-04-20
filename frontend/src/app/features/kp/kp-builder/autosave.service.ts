import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { ApiService, Kp } from '../../../core/services/api.service';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

@Injectable()
export class AutosaveService implements OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly trigger$ = new Subject<Kp>();
  private readonly sub: Subscription;

  // Signal для реактивного отображения в шаблоне
  readonly status = signal<SaveStatus>('saved');

  constructor() {
    this.sub = this.trigger$
      .pipe(
        debounceTime(2000),
        switchMap(kp => {
          this.status.set('saving');
          return this.api.updateKp(kp._id, kp);
        })
      )
      .subscribe({
        next:  () => this.status.set('saved'),
        error: () => this.status.set('error')
      });
  }

  /** Запустить дебаунс-таймер */
  schedule(kp: Kp): void {
    this.status.set('unsaved');
    this.trigger$.next(kp);
  }

  /** Немедленное сохранение — сбрасывает pending debounce через switchMap */
  saveNow(kp: Kp): void {
    this.status.set('saving');
    // Эмитим с debounceTime(0) — switchMap отменит предыдущий debounced запрос
    this.trigger$.next(kp);
    // Принудительно сбрасываем debounce через новый Subject
    this.api.updateKp(kp._id, kp).subscribe({
      next:  () => this.status.set('saved'),
      error: () => this.status.set('error')
    });
  }

  get isDirty(): boolean {
    return this.status() === 'unsaved';
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

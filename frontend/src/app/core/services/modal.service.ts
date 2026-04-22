import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type ModalConfirmType = 'danger' | 'primary';

export interface ConfirmModalConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ModalConfirmType;
}

interface ConfirmModalState {
  config: ConfirmModalConfig;
  resolver: Subject<boolean>;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly confirmState = signal<ConfirmModalState | null>(null);

  confirm(config: ConfirmModalConfig): Observable<boolean> {
    const resolver = new Subject<boolean>();
    this.confirmState.set({
      config: {
        confirmText: 'Подтвердить',
        cancelText: 'Отмена',
        type: 'primary',
        ...config
      },
      resolver
    });
    return resolver.asObservable();
  }

  resolveConfirm(confirmed: boolean): void {
    const state = this.confirmState();
    if (!state) return;
    state.resolver.next(confirmed);
    state.resolver.complete();
    this.confirmState.set(null);
  }
}

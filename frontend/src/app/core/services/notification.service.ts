import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id:      number;
  type:    ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly toasts = signal<Toast[]>([]);
  private static readonly DUPLICATE_WINDOW_MS = 2500;
  private counter = 0;
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private lastToastSignature: string | null = null;
  private lastToastAt = 0;

  show(message: unknown, type: ToastType = 'info', duration = 4000): void {
    const normalizedMessage = this.normalizeMessage(message);
    if (!normalizedMessage) {
      return;
    }

    const signature = `${type}::${normalizedMessage}`;
    const now = Date.now();
    const withinDuplicateWindow =
      this.lastToastSignature === signature &&
      now - this.lastToastAt <= NotificationService.DUPLICATE_WINDOW_MS;

    if (withinDuplicateWindow) {
      const duplicate = this.toasts().find(toast => toast.type === type && toast.message === normalizedMessage);
      if (duplicate) {
        this.scheduleDismiss(duplicate.id, duration);
        this.lastToastAt = now;
        return;
      }
    }

    const id = ++this.counter;
    this.toasts.update(list => [...list, { id, type, message: normalizedMessage }]);
    this.scheduleDismiss(id, duration);
    this.lastToastSignature = signature;
    this.lastToastAt = now;
  }

  success(message: unknown) { this.show(message, 'success'); }
  error(message: unknown)   { this.show(message, 'error', 6000); }
  warning(message: unknown) { this.show(message, 'warning'); }
  info(message: unknown)    { this.show(message, 'info'); }

  dismiss(id: number): void {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  private scheduleDismiss(id: number, duration: number): void {
    const currentTimer = this.dismissTimers.get(id);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }
    const timer = setTimeout(() => this.dismiss(id), duration);
    this.dismissTimers.set(id, timer);
  }

  private normalizeMessage(message: unknown): string {
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    if (message && typeof message === 'object') {
      const candidate = message as { message?: unknown; error?: { message?: unknown } };
      if (typeof candidate.message === 'string' && candidate.message.trim()) {
        return candidate.message.trim();
      }
      if (typeof candidate.error?.message === 'string' && candidate.error.message.trim()) {
        return candidate.error.message.trim();
      }
    }

    return 'Произошла ошибка. Попробуйте еще раз';
  }
}

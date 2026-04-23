import { Injectable, computed, effect, signal } from '@angular/core';
import { Kp } from '../../../core/services/api.service';

@Injectable()
export class KpBuilderStore {
  private readonly _kp = signal<Kp | null>(null);
  private readonly past = signal<Kp[]>([]);
  private readonly future = signal<Kp[]>([]);
  private readonly historyLimit = 10;

  readonly kp = this._kp.asReadonly();
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  readonly isValid = computed(() => {
    const current = this._kp();
    return Boolean(current?.title && (current.items?.length ?? 0) > 0);
  });

  constructor() {
    effect(() => {
      const state = this._kp();
      if (!state?._id) return;
      this.saveBackupSnapshot(state);
    });
  }

  setKp(kp: Kp): void {
    this._kp.set(kp);
  }

  patchKp(patch: Partial<Kp>): void {
    this.withHistory((state) => ({ ...state, ...patch }));
  }

  updateMetadata(patch: Partial<Kp['metadata']>): void {
    this.withHistory((state) => ({
      ...state,
      metadata: { ...state.metadata, ...patch }
    }));
  }

  updateItemPrice(productId: string, newPrice: number): void {
    const normalizedPrice = Math.max(0, Math.round(Number.isFinite(newPrice) ? newPrice : 0));
    this.withHistory((state) => ({
      ...state,
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, price: normalizedPrice } : item
      )
    }));
  }

  updateState(updater: (current: Kp) => Kp): void {
    this.withHistory((state) => updater(this.cloneState(state)));
  }

  undo(): void {
    const history = this.past();
    const current = this._kp();
    if (!current || history.length === 0) return;
    const previous = history[history.length - 1];
    this.past.set(history.slice(0, -1));
    this.future.set([...this.future(), this.cloneState(current)]);
    this._kp.set(this.cloneState(previous));
  }

  redo(): void {
    const future = this.future();
    const current = this._kp();
    if (!current || future.length === 0) return;
    const next = future[future.length - 1];
    this.future.set(future.slice(0, -1));
    this.past.set([...this.past(), this.cloneState(current)]);
    this._kp.set(this.cloneState(next));
  }

  restoreFromBackup(kpId: string): boolean {
    try {
      const raw = localStorage.getItem(this.backupKey(kpId));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Kp;
      if (!parsed || parsed._id !== kpId) return false;
      this._kp.set(parsed);
      this.resetHistory();
      return true;
    } catch {
      return false;
    }
  }

  clearBackup(kpId: string): void {
    localStorage.removeItem(this.backupKey(kpId));
  }

  private withHistory(updater: (state: Kp) => Kp): void {
    this._kp.update((state) => {
      if (!state) return null;
      this.pushToHistory(state);
      return updater(state);
    });
  }

  private pushToHistory(state: Kp): void {
    const nextHistory = [...this.past(), this.cloneState(state)];
    this.past.set(nextHistory.slice(-this.historyLimit));
    this.future.set([]);
  }

  private resetHistory(): void {
    this.past.set([]);
    this.future.set([]);
  }

  private backupKey(kpId: string): string {
    return `kp_builder_backup_${kpId}`;
  }

  private saveBackupSnapshot(kp: Kp): void {
    try {
      localStorage.setItem(this.backupKey(kp._id), JSON.stringify(kp));
    } catch {
      // Ignore storage quota and private mode errors.
    }
  }

  private cloneState(state: Kp): Kp {
    return JSON.parse(JSON.stringify(state)) as Kp;
  }

  clear(): void {
    const currentId = this._kp()?._id;
    this._kp.set(null);
    this.resetHistory();
    if (currentId) this.clearBackup(currentId);
  }
}

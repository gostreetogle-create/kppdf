import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    const saved = localStorage.getItem('kppdf-theme');
    const initial: ThemeMode = saved === 'dark' ? 'dark' : 'light';
    this.apply(initial);
  }

  toggle() {
    this.apply(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private apply(mode: ThemeMode) {
    this.mode.set(mode);
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('kppdf-theme', mode);
  }
}

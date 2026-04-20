import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Kp } from '../../core/services/api.service';
import { ButtonComponent, BadgeComponent, AlertComponent } from '../../shared/ui/index';
import type { BadgeColor } from '../../shared/ui/badge/badge.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, BadgeComponent, AlertComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  kpList      = signal<Kp[]>([]);
  loading     = signal(true);
  error       = signal('');
  duplicating = signal<string | null>(null);

  ngOnInit() {
    this.api.getKpList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  list => { this.kpList.set(list); this.loading.set(false); },
        error: ()   => { this.loading.set(false); this.error.set('Не удалось загрузить список КП'); }
      });
  }

  createNew() {
    const draft: Partial<Kp> = {
      title: 'Новое КП', status: 'draft',
      recipient: { name: '' },
      metadata: { number: `КП-${Date.now()}`, validityDays: 10, prepaymentPercent: 50, productionDays: 15 },
      items: [], conditions: [], vatPercent: 20
    };
    this.api.createKp(draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  kp  => this.router.navigate(['/kp', kp._id]),
        error: ()  => this.error.set('Не удалось создать КП')
      });
  }

  open(id: string) { this.router.navigate(['/kp', id]); }

  delete(id: string, event: Event) {
    event.stopPropagation();
    this.api.deleteKp(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  () => this.kpList.update(list => list.filter(k => k._id !== id)),
        error: () => this.error.set('Не удалось удалить КП')
      });
  }

  duplicate(id: string, event: Event) {
    event.stopPropagation();
    this.duplicating.set(id);
    this.api.duplicateKp(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  kp => { this.duplicating.set(null); this.router.navigate(['/kp', kp._id]); },
        error: ()  => { this.duplicating.set(null); this.error.set('Не удалось дублировать КП'); }
      });
  }

  getTotal(kp: Kp): number {
    const sub = kp.items.reduce((s, i) => s + i.price * i.qty, 0);
    return sub + Math.round(sub * kp.vatPercent / 100);
  }

  statusLabel(status: Kp['status']): string {
    return { draft: 'Черновик', sent: 'Отправлен', accepted: 'Принят', rejected: 'Отклонён' }[status];
  }

  statusColor(status: Kp['status']): BadgeColor {
    return { draft: 'default', sent: 'blue', accepted: 'green', rejected: 'red' }[status] as BadgeColor;
  }
}

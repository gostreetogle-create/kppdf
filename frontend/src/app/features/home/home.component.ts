import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Kp, CreateKpPayload } from '../../core/services/api.service';
import { take } from 'rxjs';
import { ButtonComponent, AlertComponent, StatusBadgeComponent, PageLayoutComponent, PageHeaderComponent, EmptyStateComponent } from '../../shared/ui/index';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, StatusBadgeComponent, AlertComponent, PageLayoutComponent, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly router     = inject(Router);
  private readonly modal      = inject(ModalService);
  private readonly ns         = inject(NotificationService);
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
    const draft: CreateKpPayload = {
      title: 'Новое КП',
      status: 'draft',
      recipient: { name: '' },
      items: [], conditions: []
    };
    this.api.createKp(draft)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  kp  => {
          this.ns.success('Черновик КП создан');
          this.router.navigate(['/kp', kp._id]);
        },
        error: (err)  => this.error.set(err?.error?.message || 'Не удалось создать КП')
      });
  }

  open(id: string) { this.router.navigate(['/kp', id]); }

  delete(id: string, event: Event) {
    event.stopPropagation();
    this.modal.confirm({
      title: 'Удалить КП',
      message: 'Коммерческое предложение будет удалено без возможности восстановления.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.deleteKp(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next:  () => {
              this.kpList.update(list => list.filter(k => k._id !== id));
              this.ns.success('КП удалено');
            },
            error: () => this.error.set('Не удалось удалить КП')
          });
      });
  }

  duplicate(id: string, event: Event) {
    event.stopPropagation();
    this.duplicating.set(id);
    this.api.duplicateKp(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  kp => {
          this.duplicating.set(null);
          this.ns.success('КП дублировано');
          this.router.navigate(['/kp', kp._id]);
        },
        error: ()  => { this.duplicating.set(null); this.error.set('Не удалось дублировать КП'); }
      });
  }

  getTotal(kp: Kp): number {
    const sub = kp.items.reduce((s, i) => s + i.price * i.qty, 0);
    return sub + Math.round(sub * kp.vatPercent / 100);
  }

  statusHint(status: Kp['status']): string {
    const map: Record<Kp['status'], string> = {
      draft: 'Можно редактировать и отправить клиенту',
      sent: 'Ожидает решения клиента',
      accepted: 'Клиент принял предложение',
      rejected: 'Клиент отклонил предложение'
    };
    return map[status];
  }
}

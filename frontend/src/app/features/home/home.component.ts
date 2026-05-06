import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Kp, CreateKpPayload } from '../../core/services/api.service';
import { take } from 'rxjs';
import { ButtonComponent, AlertComponent, PageLayoutComponent, PageHeaderComponent, EmptyStateComponent } from '../../shared/ui/index';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';
import { FormsModule } from '@angular/forms';
import { KP_STATUS_TRANSITIONS } from '@shared/types/Kp';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonComponent,
    AlertComponent,
    PageLayoutComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    FormsModule
  ],
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
    this.loadKpList();
  }

  loadKpList() {
    this.api.getKpList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  list => { this.kpList.set(list); this.loading.set(false); },
        error: ()   => { this.loading.set(false); this.error.set('Не удалось загрузить список КП'); }
      });
  }

  createNew() {
    const payload: CreateKpPayload = {
      title: 'Новое КП',
      status: 'draft',
      recipient: { name: '' },
      items: [],
      conditions: []
    };
    this.api.createKp(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  kp => this.router.navigate(['/kp', kp._id]),
        error: () => this.ns.error('Не удалось создать КП')
      });
  }

  open(id: string) {
    this.router.navigate(['/kp', id]);
  }

  delete(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.modal.confirm({
      title: 'Удалить КП?',
      message: 'Это действие нельзя отменить.',
      confirmText: 'Удалить',
      type: 'danger'
    }).pipe(take(1)).subscribe(confirmed => {
      if (!confirmed) return;
      this.api.deleteKp(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ 
          next:  () => {
            this.kpList.update(list => list.filter(kp => kp._id !== id));
            this.ns.success('КП удалено');
          },
          error: () => this.ns.error('Не удалось удалить КП')
        });
    });
  }

  duplicate(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.duplicating.set(id);
    this.api.duplicateKp(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (kp) => {
          this.kpList.update(list => [kp, ...list]);
          this.duplicating.set(null);
          this.ns.success('КП дублировано');
        },
        error: () => {
          this.duplicating.set(null);
          this.ns.error('Не удалось дублировать КП');
        }
      });
  }

  getTotal(kp: Kp): number {
    return kp.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
  }

  statusHint(status: string): string {
    const hints: Record<string, string> = {
      draft: 'В работе, можно редактировать',
      sent: 'Отправлено клиенту',
      accepted: 'Клиент подтвердил КП',
      rejected: 'Клиент отказался'
    };
    return hints[status] || '';
  }

  canSelectStatus(kp: Kp, targetStatus: Kp['status']): boolean {
    const current = kp.status;
    if (current === targetStatus) return true;
    const allowed = KP_STATUS_TRANSITIONS[current] ?? [];
    return allowed.includes(targetStatus);
  }

  onStatusChange(kp: Kp, nextStatus: Kp['status']) {
    if (kp.status === nextStatus) return;

    this.modal.confirm({
      title: 'Смена статуса КП',
      message: `Перевести КП из «${this.statusLabel(kp.status)}» в «${this.statusLabel(nextStatus)}»?`,
      confirmText: 'Подтвердить',
      type: 'primary'
    }).pipe(take(1)).subscribe(confirmed => {
      if (!confirmed) {
        this.loadKpList();
        return;
      }

      this.api.updateKp(kp._id, { status: nextStatus })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.kpList.update(list => list.map(item =>
              item._id === kp._id ? { ...item, status: nextStatus } : item
            ));
            this.ns.success(`Статус изменён: ${this.statusLabel(nextStatus)}`);
          },
          error: () => {
            this.ns.error('Не удалось изменить статус');
            this.loadKpList();
          }
        });
    });
  }

  statusLabel(status: Kp['status']): string {
    const labels: Record<Kp['status'], string> = {
      draft: 'Черновик',
      sent: 'Отправлен',
      accepted: 'Принят',
      rejected: 'Отклонён'
    };
    return labels[status];
  }
}

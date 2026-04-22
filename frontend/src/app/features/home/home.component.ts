import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Counterparty, Kp, KpType, CreateKpPayload, KP_TYPE_LABELS } from '../../core/services/api.service';
import { take } from 'rxjs';
import { ButtonComponent, AlertComponent, StatusBadgeComponent } from '../../shared/ui/index';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent, StatusBadgeComponent, AlertComponent],
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
  companies   = signal<Counterparty[]>([]);
  selectedCompanyId = signal<string | null>(null);
  availableKpTypes = signal<Array<{ value: KpType; label: string }>>([]);
  selectedKpType = signal<KpType | null>(null);
  templatesForSelectedType = signal<Array<{ key: string; name: string; isDefault: boolean }>>([]);
  selectedTemplateMode = signal<string>('auto');
  templatesWarning = signal('');

  ngOnInit() {
    this.api.getKpList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  list => { this.kpList.set(list); this.loading.set(false); },
        error: ()   => { this.loading.set(false); this.error.set('Не удалось загрузить список КП'); }
      });

    this.api.getCounterparties({ isOurCompany: true, status: 'active' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: list => {
          this.companies.set(list);
          if (list.length > 0 && !this.selectedCompanyId()) {
            const preferred = list.find((company) => company.isDefaultInitiator) ?? list[0];
            this.onCompanyChanged(preferred._id);
          }
        },
        error: () => this.ns.error('Не удалось загрузить список компаний-инициаторов')
      });
  }

  onCompanyChanged(companyId: string | null) {
    this.selectedCompanyId.set(companyId);
    this.availableKpTypes.set([]);
    this.selectedKpType.set(null);
    this.templatesForSelectedType.set([]);
    this.selectedTemplateMode.set('auto');
    this.templatesWarning.set('');

    if (!companyId) return;

    this.api.getBrandingTemplates(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          const kpTypes = dto.kpTypes ?? [];
          this.availableKpTypes.set(kpTypes);
          if (kpTypes.length === 0) {
            this.templatesWarning.set('У компании нет настроенных шаблонов брендирования. Обратитесь к администратору.');
            return;
          }
          this.onKpTypeChanged(kpTypes[0].value);
        },
        error: (err) => {
          this.templatesWarning.set(err?.error?.message || 'Не удалось загрузить шаблоны брендирования компании');
        }
      });
  }

  onKpTypeChanged(kpType: KpType | null) {
    this.selectedKpType.set(kpType);
    this.templatesForSelectedType.set([]);
    this.selectedTemplateMode.set('auto');
    this.templatesWarning.set('');
    const companyId = this.selectedCompanyId();
    if (!companyId || !kpType) return;

    this.api.getBrandingTemplates(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          const templates = [...(dto.templatesByType?.[kpType] ?? [])]
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
          this.templatesForSelectedType.set(templates);
          if (templates.length === 0) {
            this.templatesWarning.set('Для выбранного типа КП нет шаблонов брендирования.');
          }
        },
        error: (err) => {
          this.templatesWarning.set(err?.error?.message || 'Не удалось загрузить шаблоны выбранного типа');
        }
      });
  }

  kpTypeLabel(value: KpType): string {
    return KP_TYPE_LABELS[value] ?? value;
  }

  templateLabel(template: { name: string; isDefault: boolean }): string {
    return template.isDefault ? `✓ ${template.name}` : template.name;
  }

  canCreateKp(): boolean {
    return Boolean(this.selectedCompanyId() && this.selectedKpType() && this.templatesForSelectedType().length > 0);
  }

  createNew() {
    const companyId = this.selectedCompanyId();
    const kpType = this.selectedKpType();
    if (!companyId) {
      this.ns.error('Выберите компанию-инициатора');
      return;
    }
    if (!kpType) {
      this.ns.error('Выберите тип КП');
      this.error.set('Выберите тип КП');
      return;
    }
    if (this.templatesForSelectedType().length === 0) {
      const message = 'У компании нет настроенных шаблонов брендирования. Обратитесь к администратору.';
      this.ns.error(message);
      this.error.set(message);
      return;
    }

    const draft: CreateKpPayload = {
      title: 'Новое КП',
      status: 'draft',
      companyId,
      kpType,
      ...(this.selectedTemplateMode() !== 'auto' ? { templateKey: this.selectedTemplateMode() } : {}),
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

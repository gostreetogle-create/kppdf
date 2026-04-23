import { Component, signal, inject, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap, catchError, of, take } from 'rxjs';
import { ApiService, Counterparty, CpRole } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ModalService } from '../../core/services/modal.service';
import { CounterpartyTableComponent } from './components/counterparty-table/counterparty-table.component';
import { BrandingTemplatesManagerComponent } from './components/branding-templates-manager/branding-templates-manager.component';
import { CounterpartyFormComponent } from '../../shared/components/counterparty-form/counterparty-form.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { FilterSelectComponent } from '../../shared/ui/filter-select/filter-select.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-counterparties',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CounterpartyTableComponent, CounterpartyFormComponent,
    BrandingTemplatesManagerComponent,
    ButtonComponent, AlertComponent, SearchInputComponent, FilterSelectComponent
  ],
  templateUrl: './counterparties.component.html',
  styleUrls: [
    './counterparties.component.scss',
    './counterparties.filters.scss'
  ]
})
export class CounterpartiesComponent {
  private readonly api        = inject(ApiService);
  private readonly ns         = inject(NotificationService);
  private readonly modal      = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);

  counterparties = signal<Counterparty[]>([]);
  loading        = signal(true);
  error          = signal('');
  search         = signal('');
  filterRole     = signal<CpRole | ''>('');
  filterStatus   = signal<'active' | 'inactive' | ''>('');
  formOpen       = signal(false);
  brandingOpen   = signal(false);
  editTarget     = signal<Counterparty | null>(null);
  brandingTarget = signal<Counterparty | null>(null);
  deleteTarget   = signal<Counterparty | null>(null);
  private pendingBrandingCompanyId = signal<string | null>(null);
  clientCounterparties = computed(() => this.counterparties().filter((cp) => this.hasRole(cp, 'client')));
  supplierCounterparties = computed(() => this.counterparties().filter((cp) => this.hasRole(cp, 'supplier')));
  companyCounterparties = computed(() => this.counterparties().filter((cp) => this.hasRole(cp, 'company')));

  constructor() {
    const shouldOpenBranding = this.route.snapshot.queryParamMap.get('openBranding') === '1';
    const companyId = this.route.snapshot.queryParamMap.get('companyId');
    if (shouldOpenBranding && companyId) {
      this.pendingBrandingCompanyId.set(companyId);
    }

    // toObservable() вызывается в constructor — injection context гарантирован
    combineLatest([
      toObservable(this.search),
      toObservable(this.filterRole),
      toObservable(this.filterStatus),
    ]).pipe(
      debounceTime(300),
      switchMap(([q, role, status]) => {
        this.loading.set(true);
        this.error.set('');
        const params: Record<string, string> = {};
        if (q)      params['q']      = q;
        if (role)   params['role']   = role;
        if (status) params['status'] = status;
        return this.api.getCounterparties(params as any).pipe(
          catchError(err => {
            this.error.set(err.error?.message ?? 'Не удалось загрузить контрагентов');
            return of([]);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(list => {
      this.counterparties.set(list);
      this.loading.set(false);
      this.tryOpenPendingBranding();
    });
  }

  openCreate() { this.editTarget.set(null); this.formOpen.set(true); }
  openEdit(cp: Counterparty) { this.editTarget.set(cp); this.formOpen.set(true); }
  closeForm() {
    this.formOpen.set(false);
    this.editTarget.set(null);
  }

  openBranding(cp: Counterparty) {
    this.brandingTarget.set(cp);
    this.brandingOpen.set(true);
  }

  closeBranding() {
    this.brandingOpen.set(false);
    this.brandingTarget.set(null);
  }

  onSaved(cp: Counterparty) {
    const isEdit = !!this.editTarget();
    this.counterparties.update(list =>
      isEdit ? list.map(c => c._id === cp._id ? cp : c) : [cp, ...list]
    );
    this.closeForm();
    this.ns.success(isEdit ? 'Контрагент обновлён' : 'Контрагент создан');
  }

  onBrandingSaved(cp: Counterparty) {
    this.counterparties.update(list => list.map((item) => item._id === cp._id ? cp : item));
    this.closeBranding();
    this.ns.success('Шаблоны брендирования обновлены');
  }

  confirmDelete(cp: Counterparty) {
    this.modal.confirm({
      title: 'Удалить контрагента',
      message: `Контрагент «${cp.name}» будет удалён без возможности восстановления.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deleteTarget.set(cp);
        this.onDeleteConfirmed();
      });
  }

  onDeleteConfirmed() {
    const cp = this.deleteTarget();
    if (!cp) return;
    this.api.deleteCounterparty(cp._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.counterparties.update(list => list.filter(c => c._id !== cp._id));
          this.deleteTarget.set(null);
          this.ns.success('Контрагент удалён');
        },
        error: () => {
          this.deleteTarget.set(null);
          this.ns.error('Не удалось удалить контрагента');
        }
      });
  }

  private hasRole(cp: Counterparty, role: CpRole): boolean {
    if (role === 'company' && cp.isOurCompany) return true;
    return (cp.role ?? []).includes(role);
  }

  private tryOpenPendingBranding() {
    const pendingId = this.pendingBrandingCompanyId();
    if (!pendingId) return;
    const company = this.counterparties().find((cp) => cp._id === pendingId);
    if (!company) return;
    this.pendingBrandingCompanyId.set(null);
    this.openBranding(company);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { openBranding: null, companyId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}

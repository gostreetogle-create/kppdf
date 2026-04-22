import { Component, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap, catchError, of } from 'rxjs';
import { ApiService, Counterparty, CpRole } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { CounterpartyTableComponent } from './components/counterparty-table/counterparty-table.component';
import { CounterpartyFormComponent } from '../../shared/components/counterparty-form/counterparty-form.component';
import { ConfirmDialogComponent } from '../products/components/confirm-dialog/confirm-dialog.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { SearchInputComponent } from '../../shared/ui/search-input/search-input.component';
import { FilterSelectComponent } from '../../shared/ui/filter-select/filter-select.component';

@Component({
  selector: 'app-counterparties',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CounterpartyTableComponent, CounterpartyFormComponent, ConfirmDialogComponent,
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
  private readonly destroyRef = inject(DestroyRef);

  counterparties = signal<Counterparty[]>([]);
  loading        = signal(true);
  error          = signal('');
  search         = signal('');
  filterRole     = signal<CpRole | ''>('');
  filterStatus   = signal<'active' | 'inactive' | ''>('');
  formOpen       = signal(false);
  editTarget     = signal<Counterparty | null>(null);
  deleteTarget   = signal<Counterparty | null>(null);

  constructor() {
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
    });
  }

  openCreate() { this.editTarget.set(null); this.formOpen.set(true); }
  openEdit(cp: Counterparty) { this.editTarget.set(cp); this.formOpen.set(true); }
  closeForm() {
    this.formOpen.set(false);
    this.editTarget.set(null);
  }

  onSaved(cp: Counterparty) {
    const isEdit = !!this.editTarget();
    this.counterparties.update(list =>
      isEdit ? list.map(c => c._id === cp._id ? cp : c) : [cp, ...list]
    );
    this.closeForm();
    this.ns.success(isEdit ? 'Контрагент обновлён' : 'Контрагент создан');
  }

  confirmDelete(cp: Counterparty) { this.deleteTarget.set(cp); }

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
}

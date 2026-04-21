import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Dictionary, DictionaryType } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/ui/index';

type DictionaryForm = {
  type: DictionaryType;
  value: string;
  sortOrder: number;
  isActive: boolean;
};

@Component({
  selector: 'app-dictionaries',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './dictionaries.component.html',
  styleUrl: './dictionaries.component.scss'
})
export class DictionariesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly ns = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly items = signal<Dictionary[]>([]);
  readonly filterType = signal<'' | DictionaryType>('');
  readonly editTarget = signal<Dictionary | null>(null);

  createForm: DictionaryForm = this.getDefaultForm();
  editForm: DictionaryForm = this.getDefaultForm();

  readonly types: { value: DictionaryType; label: string }[] = [
    { value: 'category', label: 'Категория' },
    { value: 'subcategory', label: 'Подкатегория' },
    { value: 'unit', label: 'Единица' },
    { value: 'kind', label: 'Тип (товар/услуга/работа)' }
  ];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    const type = this.filterType() || undefined;
    this.api.getDictionaries(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.items.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.ns.error('Не удалось загрузить справочники');
        }
      });
  }

  onFilterTypeChanged(type: '' | DictionaryType) {
    this.filterType.set(type);
    this.load();
  }

  createItem() {
    const value = this.createForm.value.trim();
    if (!value) {
      this.ns.error('Значение справочника обязательно');
      return;
    }

    this.saving.set(true);
    this.api.createDictionaryItem({
      ...this.createForm,
      value
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.saving.set(false);
          this.items.update(list => [item, ...list].sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value)));
          this.createForm = this.getDefaultForm(this.createForm.type);
          this.ns.success('Запись справочника создана');
        },
        error: () => {
          this.saving.set(false);
          this.ns.error('Не удалось создать запись');
        }
      });
  }

  startEdit(item: Dictionary) {
    this.editTarget.set(item);
    this.editForm = {
      type: item.type,
      value: item.value,
      sortOrder: item.sortOrder,
      isActive: item.isActive
    };
  }

  cancelEdit() {
    this.editTarget.set(null);
    this.editForm = this.getDefaultForm();
  }

  saveEdit() {
    const target = this.editTarget();
    if (!target) return;

    const value = this.editForm.value.trim();
    if (!value) {
      this.ns.error('Значение справочника обязательно');
      return;
    }

    this.saving.set(true);
    this.api.updateDictionaryItem(target._id, { ...this.editForm, value })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.items.update(list => list.map(item => item._id === updated._id ? updated : item));
          this.cancelEdit();
          this.ns.success('Запись обновлена');
        },
        error: () => {
          this.saving.set(false);
          this.ns.error('Не удалось обновить запись');
        }
      });
  }

  deleteItem(item: Dictionary) {
    if (!window.confirm(`Удалить "${item.value}"?`)) return;

    this.api.deleteDictionaryItem(item._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update(list => list.filter(x => x._id !== item._id));
          this.ns.success('Запись удалена');
        },
        error: () => this.ns.error('Не удалось удалить запись')
      });
  }

  private getDefaultForm(type: DictionaryType = 'category'): DictionaryForm {
    return {
      type,
      value: '',
      sortOrder: 100,
      isActive: true
    };
  }
}

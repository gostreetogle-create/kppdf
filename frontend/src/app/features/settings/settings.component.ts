import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, Setting, SettingsMap } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import { ButtonComponent } from '../../shared/ui/index';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private readonly api        = inject(ApiService);
  private readonly ns         = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  settings = signal<Setting[]>([]);
  loading  = signal(true);
  saving   = signal(false);

  // Локальная копия для редактирования
  values: Record<string, unknown> = {};

  ngOnInit() {
    this.api.getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list }) => {
          this.settings.set(list);
          list.forEach(s => { this.values[s.key] = s.value; });
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.ns.error('Не удалось загрузить настройки'); }
      });
  }

  save() {
    this.saving.set(true);
    this.api.updateSettings(this.values as SettingsMap)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list }) => {
          this.settings.set(list);
          this.saving.set(false);
          this.ns.success('Настройки сохранены');
        },
        error: () => { this.saving.set(false); this.ns.error('Ошибка сохранения'); }
      });
  }
}

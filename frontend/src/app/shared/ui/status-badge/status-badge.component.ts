import { Component, input } from '@angular/core';

export type StatusBadgeVariant =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'active'
  | 'inactive'
  | 'owner'
  | 'admin'
  | 'manager'
  | 'viewer'
  | 'client'
  | 'supplier'
  | 'company';

@Component({
  selector: 'ui-status-badge',
  standalone: true,
  template: `{{ label() || defaultLabel() }}`,
  styleUrl: './status-badge.component.scss',
  host: {
    '[class]': '"status-badge status-badge--" + variant()',
    '[attr.title]': 'hint() || null'
  }
})
export class StatusBadgeComponent {
  variant = input.required<StatusBadgeVariant>();
  label = input<string>('');
  hint = input<string>('');

  defaultLabel(): string {
    const map: Record<StatusBadgeVariant, string> = {
      draft: 'Черновик',
      sent: 'Отправлен',
      accepted: 'Принят',
      rejected: 'Отклонен',
      active: 'Активен',
      inactive: 'Неактивен',
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      viewer: 'Viewer',
      client: 'Клиент',
      supplier: 'Поставщик',
      company: 'Компания'
    };
    return map[this.variant()];
  }
}

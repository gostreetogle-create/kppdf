import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Counterparty } from '../../../../core/services/api.service';
import { StatusBadgeComponent, StatusBadgeVariant } from '../../../../shared/ui/status-badge/status-badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-counterparty-table',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, ButtonComponent],
  templateUrl: './counterparty-table.component.html',
  styleUrl: './counterparty-table.component.scss'
})
export class CounterpartyTableComponent {
  counterparties = input.required<Counterparty[]>();
  edit           = output<Counterparty>();
  delete         = output<Counterparty>();

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      client:  'Клиент',
      supplier: 'Поставщик',
      company:  'Наша компания',
    };
    return map[role] ?? role;
  }

  roleVariant(role: string): StatusBadgeVariant {
    const map: Record<string, StatusBadgeVariant> = {
      client: 'client',
      supplier: 'supplier',
      company: 'company',
    };
    return map[role] ?? 'client';
  }
}

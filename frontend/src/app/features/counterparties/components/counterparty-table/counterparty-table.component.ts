import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Counterparty } from '../../../../core/services/api.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-counterparty-table',
  standalone: true,
  imports: [CommonModule, BadgeComponent, ButtonComponent],
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

  roleColor(role: string): 'blue' | 'orange' | 'green' {
    const map: Record<string, 'blue' | 'orange' | 'green'> = {
      client:  'blue',
      supplier: 'orange',
      company:  'green',
    };
    return map[role] ?? 'blue';
  }
}

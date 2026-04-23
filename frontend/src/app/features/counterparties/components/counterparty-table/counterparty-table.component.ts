import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Counterparty } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-counterparty-table',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './counterparty-table.component.html',
  styleUrl: './counterparty-table.component.scss'
})
export class CounterpartyTableComponent {
  counterparties = input.required<Counterparty[]>();
  showBrandingButton = input(false);
  edit           = output<Counterparty>();
  delete         = output<Counterparty>();
  branding       = output<Counterparty>();
}

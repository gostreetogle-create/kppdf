import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpTotals {
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
}

@Component({
  selector: 'app-kp-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kp-table.component.html',
  styleUrl: './kp-table.component.scss'
})
export class KpTableComponent {
  totals = input.required<KpTotals>();
  conditions = input<string[]>([]);
}
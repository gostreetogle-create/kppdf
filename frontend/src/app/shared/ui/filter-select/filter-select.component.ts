import { Component, input, output } from '@angular/core';

export interface FilterSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'ui-filter-select',
  standalone: true,
  templateUrl: './filter-select.component.html',
  styleUrl: './filter-select.component.scss'
})
export class FilterSelectComponent {
  value = input('');
  options = input<FilterSelectOption[]>([]);
  valueChange = output<string>();
}

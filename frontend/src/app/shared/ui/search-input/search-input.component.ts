import { Component, input, output } from '@angular/core';

@Component({
  selector: 'ui-search-input',
  standalone: true,
  templateUrl: './search-input.component.html',
  styleUrl: './search-input.component.scss'
})
export class SearchInputComponent {
  value = input('');
  placeholder = input('Поиск...');
  fullWidth = input(false);
  valueChange = output<string>();
}

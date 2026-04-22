import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type PermissionDefinition } from '../../core/services/api.service';

@Component({
  selector: 'app-permission-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './permission-group.component.html',
  styleUrl: './permission-group.component.scss'
})
export class PermissionGroupComponent {
  title = input.required<string>();
  permissions = input.required<PermissionDefinition[]>();
  selected = input.required<Set<string>>();
  disabled = input(false);

  toggle = output<{ key: string; checked: boolean }>();

  isChecked(key: string): boolean {
    return this.selected().has(key);
  }

  onToggle(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggle.emit({ key, checked });
  }
}

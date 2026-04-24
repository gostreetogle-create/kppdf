import { Component, computed, contentChild, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, NgControl } from '@angular/forms';
import { merge, Subscription } from 'rxjs';
import { mapControlError } from './form-error-messages';

@Component({
  selector: 'ui-form-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-field.component.html',
  styleUrl: './form-field.component.scss'
})
export class FormFieldComponent {
  private controlChangesSub: Subscription | null = null;
  private controlRevision = signal(0);

  label    = input('');
  required = input(false);
  error    = input('');
  hint     = input('');
  control = input<AbstractControl | null>(null);
  submitted = input(false);
  private projectedNgControl = contentChild(NgControl, { descendants: true });

  constructor() {
    effect((onCleanup) => {
      const control = this.control() ?? this.projectedNgControl()?.control ?? null;
      this.controlChangesSub?.unsubscribe();
      this.controlChangesSub = null;
      if (!control) return;
      this.controlChangesSub = merge(control.statusChanges, control.valueChanges).subscribe(() => {
        this.controlRevision.update((value) => value + 1);
      });
      this.controlRevision.update((value) => value + 1);
      onCleanup(() => {
        this.controlChangesSub?.unsubscribe();
        this.controlChangesSub = null;
      });
    });
  }

  readonly errorText = computed(() => {
    this.controlRevision();
    const manualError = this.error();
    if (manualError) return manualError;
    const control = this.control() ?? this.projectedNgControl()?.control ?? null;
    if (!control) return '';
    if (!control.invalid || (!control.touched && !control.dirty && !this.submitted())) return '';
    return mapControlError(control.errors);
  });
}

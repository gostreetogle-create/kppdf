import { CanDeactivateFn } from '@angular/router';
import { KpBuilderComponent } from './kp-builder.component';

export const canDeactivateBuilder: CanDeactivateFn<KpBuilderComponent> = (component) =>
  component.confirmDeactivate();

import { CanDeactivateFn } from '@angular/router';
import { KpBuilderComponent } from './kp-builder.component';

export const canDeactivateBuilder: CanDeactivateFn<KpBuilderComponent> = (component) => {
  if (!component.isDirty()) return true;
  return confirm('Есть несохранённые изменения. Уйти со страницы?');
};

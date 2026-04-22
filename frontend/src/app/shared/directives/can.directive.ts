import { Directive, TemplateRef, ViewContainerRef, inject, input, effect } from '@angular/core';
import type { Permission } from '../../../../../shared/types/User';
import { PermissionsService } from '../../core/services/permissions.service';

@Directive({
  selector: '[appCan]',
  standalone: true
})
export class CanDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionsService);

  appCan = input.required<Permission>();
  private hasView = false;

  constructor() {
    effect(() => {
      const allowed = this.permissions.can(this.appCan());
      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}


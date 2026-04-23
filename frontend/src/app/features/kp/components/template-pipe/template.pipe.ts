import { Pipe, PipeTransform, inject } from '@angular/core';
import { KpTemplateService } from '../../kp-builder/kp-template.service';

@Pipe({
  name: 'kpTemplate',
  standalone: true,
  pure: false
})
export class KpTemplatePipe implements PipeTransform {
  private readonly templateService = inject(KpTemplateService);

  transform(value: string): string {
    return this.templateService.parse(value ?? '');
  }
}

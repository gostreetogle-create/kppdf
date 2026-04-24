import { ValidationErrors } from '@angular/forms';

export function mapControlError(errors: ValidationErrors | null | undefined): string {
  if (!errors) return '';
  if (errors['required']) return 'Обязательное поле';
  if (errors['email']) return 'Неверный формат email';
  if (errors['minlength']) {
    const req = errors['minlength'].requiredLength;
    return `Слишком короткое значение (минимум ${req})`;
  }
  if (errors['pattern']) return 'Неверный формат значения';
  return 'Некорректное значение';
}

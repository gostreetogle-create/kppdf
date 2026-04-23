import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FormFieldComponent, AlertComponent, ButtonComponent } from '../../shared/ui/index';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, FormFieldComponent, AlertComponent, ButtonComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  rememberMe = true;
  guestLink = '';
  loading  = signal(false);
  error    = signal('');

  submit() {
    if (!this.username || !this.password) {
      this.error.set('Введите логин и пароль');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password, this.rememberMe).subscribe({
      next:  () => this.router.navigate(['/']),
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Ошибка входа');
      }
    });
  }

  enterGuest(): void {
    const raw = this.guestLink.trim();
    if (!raw) {
      this.error.set('Вставьте гостевую ссылку или токен');
      return;
    }

    const token = this.extractGuestToken(raw);
    if (!token) {
      this.error.set('Не удалось распознать токен гостевого доступа');
      return;
    }

    this.error.set('');
    this.router.navigate(['/guest-preview', token]);
  }

  private extractGuestToken(input: string): string | null {
    const directMatch = input.match(/\/guest-preview\/([^/?#]+)/i);
    if (directMatch?.[1]) return directMatch[1];
    if (/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(input)) return input;
    return null;
  }
}

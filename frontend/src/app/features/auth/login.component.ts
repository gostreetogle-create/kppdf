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

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  submit() {
    if (!this.email || !this.password) {
      this.error.set('Введите email и пароль');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      this.error.set('Введите корректный email');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next:  () => this.router.navigate(['/']),
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Ошибка входа');
      }
    });
  }
}

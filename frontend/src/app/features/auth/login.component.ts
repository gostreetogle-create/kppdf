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
  loading  = signal(false);
  error    = signal('');

  submit() {
    if (!this.username || !this.password) {
      this.error.set('Введите логин и пароль');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next:  () => this.router.navigate(['/']),
      error: err => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? 'Ошибка входа');
      }
    });
  }
}

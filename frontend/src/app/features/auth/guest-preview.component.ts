import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-guest-preview',
  standalone: true,
  templateUrl: './guest-preview.component.html',
  styleUrl: './guest-preview.component.scss'
})
export class GuestPreviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set('Ссылка гостевого просмотра некорректна.');
      return;
    }

    this.auth.guestEnter(token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigateByUrl('/');
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Не удалось открыть гостевой просмотр.');
        }
      });
  }

  goToLogin(): void {
    this.router.navigateByUrl('/login');
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  readonly auth = inject(AuthService);
  readonly showRestoreHint = signal(false);
  private readonly restoreHintDelayMs = 500;
  private restoreHintTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.restoreHintTimer = setTimeout(() => {
      if (!this.auth.authReady()) {
        this.showRestoreHint.set(true);
      }
    }, this.restoreHintDelayMs);

    this.auth.initSession().subscribe((isLoggedIn) => {
      console.log(isLoggedIn ? 'Сессия восстановлена' : 'Нужен логин');
      this.clearRestoreHint();
    });
  }

  private clearRestoreHint(): void {
    if (this.restoreHintTimer) {
      clearTimeout(this.restoreHintTimer);
      this.restoreHintTimer = null;
    }
    this.showRestoreHint.set(false);
  }
}

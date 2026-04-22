import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ButtonComponent } from '../../../shared/ui/index';
import { ToastComponent } from '../toast/toast.component';
import { CanDirective } from '../../../shared/directives/can.directive';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ButtonComponent, ToastComponent, CanDirective],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  readonly user         = this.auth.currentUser;
  readonly sidebarOpen  = signal(false);
  readonly themeMode    = this.theme.mode;

  logout()         { this.auth.logout(); }
  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
  toggleTheme()    { this.theme.toggle(); }
}

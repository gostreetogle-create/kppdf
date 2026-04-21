import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ButtonComponent } from '../../../shared/ui/index';
import { ToastComponent } from '../toast/toast.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ButtonComponent, ToastComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  readonly user         = this.auth.currentUser;
  readonly isAdmin      = this.auth.isAdmin;
  readonly sidebarOpen  = signal(false);

  logout()         { this.auth.logout(); }
  toggleSidebar()  { this.sidebarOpen.update(v => !v); }
  closeSidebar()   { this.sidebarOpen.set(false); }
}

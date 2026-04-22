import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly authReady = this.auth.authReady;
  readonly token = this.auth.token;
}


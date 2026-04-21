import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  _id:   string;
  email: string;
  name:  string;
  role:  'admin' | 'manager';
}

const TOKEN_KEY = 'kp_token';
const USER_KEY  = 'kp_user';
const BASE      = `${environment.apiUrl}/auth`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token    = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user     = signal<AuthUser | null>(this.restoreUser());
  // AUTH READY GATE — true только после завершения initAuth()
  readonly authReady         = signal(false);

  readonly isAuthenticated = computed(() => !!this._token());
  readonly currentUser     = computed(() => this._user());
  readonly token           = computed(() => this._token());

  /**
   * APP_INITIALIZER вызывает этот метод и ждёт Promise.
   * Angular НЕ запускает роутинг пока Promise не resolved.
   * Поэтому authGuard всегда видит authReady = true.
   */
  async initAuth(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      this.authReady.set(true);
      return;
    }

    try {
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${BASE}/me`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
        })
      );
      this._token.set(token);
      this._user.set(user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // Токен истёк или бэкенд недоступен → silent logout
      this.clearToken();
    } finally {
      this.authReady.set(true);
    }
  }

  login(email: string, password: string): Observable<{ token: string; user: AuthUser }> {
    return this.http
      .post<{ token: string; user: AuthUser }>(`${BASE}/login`, { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._token.set(res.token);
          this._user.set(res.user);
        })
      );
  }

  logout(): void {
    this.http.post(`${BASE}/logout`, {}).subscribe();
    this.clearToken();
    this.router.navigate(['/login']);
  }

  private restoreUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }
}

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthUser } from '../../../../../shared/types/User';

const ACCESS_TOKEN_KEY = 'kp_access_token';
const REFRESH_TOKEN_KEY = 'kp_refresh_token';
const USER_KEY  = 'kp_user';
const BASE      = `${environment.apiUrl}/auth`;
const GUEST_SESSION_KEY = 'kp_guest_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  private readonly _refreshToken = signal<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
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
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const isGuestSession = localStorage.getItem(GUEST_SESSION_KEY) === '1';

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
      this._refreshToken.set(refreshToken);
      this._user.set(user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      const rotated = isGuestSession ? false : await this.tryRefresh();
      if (!rotated) this.clearToken();
    } finally {
      this.authReady.set(true);
    }
  }

  login(username: string, password: string): Observable<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    return this.http
      .post<{ accessToken: string; refreshToken: string; user: AuthUser }>(`${BASE}/login`, { username, password })
      .pipe(
        tap(res => {
          localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          localStorage.removeItem(GUEST_SESSION_KEY);
          this._token.set(res.accessToken);
          this._refreshToken.set(res.refreshToken);
          this._user.set(res.user);
        })
      );
  }

  guestEnter(linkToken: string): Observable<{ accessToken: string; user: AuthUser }> {
    return this.http
      .post<{ accessToken: string; user: AuthUser }>(`${environment.apiUrl}/guest/enter/${linkToken}`, {})
      .pipe(
        tap(res => {
          localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          localStorage.setItem(GUEST_SESSION_KEY, '1');
          this._token.set(res.accessToken);
          this._refreshToken.set(null);
          this._user.set(res.user);
        })
      );
  }

  logout(): void {
    this.http.post(`${BASE}/logout`, {}).subscribe({ error: () => void 0 });
    this.clearToken();
    this.router.navigate(['/login']);
  }

  refresh(): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(`${BASE}/refresh`, {
      refreshToken: this._refreshToken()
    }).pipe(
      tap(tokens => {
        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        this._token.set(tokens.accessToken);
        this._refreshToken.set(tokens.refreshToken);
      })
    );
  }

  async tryRefresh(): Promise<boolean> {
    if (!this._refreshToken()) return false;
    try {
      await firstValueFrom(this.refresh());
      const token = this._token();
      if (!token) return false;
      const user = await firstValueFrom(
        this.http.get<AuthUser>(`${BASE}/me`, {
          headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
        })
      );
      this._user.set(user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return true;
    } catch {
      return false;
    }
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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(GUEST_SESSION_KEY);
    this._token.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
  }
}

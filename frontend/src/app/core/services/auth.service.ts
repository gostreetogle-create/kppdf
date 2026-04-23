import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, firstValueFrom, Observable, of, from, catchError, map } from 'rxjs';
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

  private readonly _token = signal<string | null>(this.readStorage(ACCESS_TOKEN_KEY));
  private readonly _refreshToken = signal<string | null>(this.readStorage(REFRESH_TOKEN_KEY));
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
    const token = this.readStorage(ACCESS_TOKEN_KEY);
    const refreshToken = this.readStorage(REFRESH_TOKEN_KEY);
    const isGuestSession = this.readStorage(GUEST_SESSION_KEY) === '1';

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

  initSession(): Observable<boolean> {
    const refreshToken = this._refreshToken();
    if (!refreshToken) return of(false);
    return from(this.tryRefresh()).pipe(
      map((ok) => ok === true),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  login(username: string, password: string, rememberMe = true): Observable<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    return this.http
      .post<{ accessToken: string; refreshToken: string; user: AuthUser }>(`${BASE}/login`, { username, password })
      .pipe(
        tap(res => {
          this.persistTokens({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: res.user,
            rememberMe
          });
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
          this.clearStorageTokens();
          sessionStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
          sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
          sessionStorage.setItem(GUEST_SESSION_KEY, '1');
          this._token.set(res.accessToken);
          this._refreshToken.set(null);
          this._user.set(res.user);
        })
      );
  }

  logout(): void {
    this.http.post(`${BASE}/logout`, {}).subscribe({ error: () => void 0 });
    this.clearAuthState();
    this.router.navigate(['/login']);
  }

  refresh(): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(`${BASE}/refresh`, {
      refreshToken: this._refreshToken()
    }).pipe(
      tap(tokens => {
        const storage = this.tokenStorage();
        const alternate = storage === localStorage ? sessionStorage : localStorage;
        storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
        storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
        alternate.removeItem(ACCESS_TOKEN_KEY);
        alternate.removeItem(REFRESH_TOKEN_KEY);
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
      this.tokenStorage().setItem(USER_KEY, JSON.stringify(user));
      return true;
    } catch {
      return false;
    }
  }

  private restoreUser(): AuthUser | null {
    try {
      const raw = this.readStorage(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearToken(): void {
    this.clearAuthState();
  }

  private clearAuthState(): void {
    this.clearStorageTokens();
    this._token.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
  }

  private readStorage(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private tokenStorage(): Storage {
    if (localStorage.getItem(REFRESH_TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(REFRESH_TOKEN_KEY)) return sessionStorage;
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) return localStorage;
    if (sessionStorage.getItem(ACCESS_TOKEN_KEY)) return sessionStorage;
    return localStorage;
  }

  private clearStorageTokens(): void {
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_KEY);
      storage.removeItem(GUEST_SESSION_KEY);
    });
  }

  private persistTokens(input: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    rememberMe: boolean;
  }) {
    const storage = input.rememberMe ? localStorage : sessionStorage;
    const alternate = input.rememberMe ? sessionStorage : localStorage;
    storage.setItem(ACCESS_TOKEN_KEY, input.accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, input.refreshToken);
    storage.setItem(USER_KEY, JSON.stringify(input.user));
    storage.removeItem(GUEST_SESSION_KEY);
    alternate.removeItem(ACCESS_TOKEN_KEY);
    alternate.removeItem(REFRESH_TOKEN_KEY);
    alternate.removeItem(USER_KEY);
    alternate.removeItem(GUEST_SESSION_KEY);
  }
}

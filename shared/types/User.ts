export type UserRole = 'admin' | 'manager';

export interface IUser {
  _id:   string;
  email: string;
  name:  string;
  role:  UserRole;
}

/** Alias для совместимости с frontend */
export type AuthUser = IUser;

export interface LoginRequest  { email: string; password: string; }
export interface LoginResponse { token: string; user: IUser; }

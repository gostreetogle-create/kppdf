export type Permission =
  | 'kp.create'
  | 'kp.edit'
  | 'kp.delete'
  | 'kp.view'
  | 'products.write'
  | 'products.view'
  | 'counterparties.crud'
  | 'settings.write'
  | 'backups.manage'
  | 'users.manage';

export interface IUser {
  _id: string;
  username: string;
  name: string;
  roleId: string | null;
  roleKey: string;
  roleName: string;
  permissions: Permission[];
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
}

/** Alias для совместимости с frontend */
export type AuthUser = IUser;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

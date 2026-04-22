export type UserRole = 'owner' | 'admin' | 'manager' | 'viewer';

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

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'kp.create',
    'kp.edit',
    'kp.delete',
    'kp.view',
    'products.write',
    'products.view',
    'counterparties.crud',
    'settings.write',
    'backups.manage',
    'users.manage'
  ],
  admin: [
    'kp.create',
    'kp.edit',
    'kp.delete',
    'kp.view',
    'products.write',
    'products.view',
    'counterparties.crud',
    'settings.write',
    'backups.manage',
    'users.manage'
  ],
  manager: [
    'kp.create',
    'kp.edit',
    'kp.view',
    'products.view',
    'counterparties.crud'
  ],
  viewer: [
    'kp.view',
    'products.view'
  ]
};

export function can(user: { role: UserRole; isActive: boolean } | null | undefined, permission: Permission): boolean {
  if (!user || !user.isActive) return false;
  const rolePermissions = ROLE_PERMISSIONS[user.role] ?? [];
  return rolePermissions.includes(permission);
}


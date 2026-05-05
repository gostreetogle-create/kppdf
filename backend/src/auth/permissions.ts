import { Permission, PermissionModule, PermissionMeta } from '../../../shared/types/User';

export const PERMISSIONS: PermissionMeta[] = [
  { key: 'kp.create', label: 'Создавать КП', module: 'kp', description: 'Создание новых коммерческих предложений' },
  { key: 'kp.edit', label: 'Редактировать КП', module: 'kp', description: 'Редактирование существующих КП' },
  { key: 'kp.delete', label: 'Удалять КП', module: 'kp', description: 'Удаление коммерческих предложений' },
  { key: 'kp.view', label: 'Просматривать КП', module: 'kp', description: 'Просмотр списка и карточек КП' },
  { key: 'products.write', label: 'Управлять товарами', module: 'products', description: 'Создание и изменение товаров' },
  { key: 'products.view', label: 'Просматривать товары', module: 'products', description: 'Просмотр каталога товаров' },
  { key: 'counterparties.crud', label: 'Управлять контрагентами', module: 'counterparties', description: 'Создание, изменение и удаление контрагентов' },
  { key: 'users.manage', label: 'Управлять пользователями', module: 'users', description: 'CRUD пользователей и сброс паролей' },
  { key: 'settings.write', label: 'Изменять настройки', module: 'settings', description: 'Управление системными настройками и словарями' },
  { key: 'backups.manage', label: 'Управлять бэкапами', module: 'backups', description: 'Создание, скачивание и удаление резервных копий' }
];

export const ALL_PERMISSION_KEYS: Permission[] = PERMISSIONS.map((item) => item.key);

export const SYSTEM_ROLE_KEYS = ['owner', 'admin', 'manager', 'viewer'] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const READONLY_SYSTEM_ROLE_KEYS: SystemRoleKey[] = ['owner', 'admin'];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, Permission[]> = {
  owner: [...ALL_PERMISSION_KEYS],
  admin: [...ALL_PERMISSION_KEYS],
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

export function normalizePermissions(input: string[] | undefined | null): Permission[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set(ALL_PERMISSION_KEYS);
  return Array.from(new Set(input.filter((key): key is Permission => valid.has(key as Permission))));
}


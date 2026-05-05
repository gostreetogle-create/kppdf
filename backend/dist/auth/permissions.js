"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ROLE_PERMISSIONS = exports.READONLY_SYSTEM_ROLE_KEYS = exports.SYSTEM_ROLE_KEYS = exports.ALL_PERMISSION_KEYS = exports.PERMISSIONS = void 0;
exports.normalizePermissions = normalizePermissions;
exports.PERMISSIONS = [
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
exports.ALL_PERMISSION_KEYS = exports.PERMISSIONS.map((item) => item.key);
exports.SYSTEM_ROLE_KEYS = ['owner', 'admin', 'manager', 'viewer'];
exports.READONLY_SYSTEM_ROLE_KEYS = ['owner', 'admin'];
exports.SYSTEM_ROLE_PERMISSIONS = {
    owner: [...exports.ALL_PERMISSION_KEYS],
    admin: [...exports.ALL_PERMISSION_KEYS],
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
function normalizePermissions(input) {
    if (!Array.isArray(input))
        return [];
    const valid = new Set(exports.ALL_PERMISSION_KEYS);
    return Array.from(new Set(input.filter((key) => valid.has(key))));
}

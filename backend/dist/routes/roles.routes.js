"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const role_model_1 = require("../models/role.model");
const permissions_1 = require("../auth/permissions");
const users_service_1 = require("../services/users.service");
const router = (0, express_1.Router)();
const usersService = new users_service_1.UsersService();
function createRoleKey(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .replace(/_+/g, '_');
}
router.get('/', async (_req, res) => {
    try {
        const roles = await role_model_1.Role.find().sort({ isSystem: -1, name: 1 });
        res.json(roles);
    }
    catch {
        res.status(500).json({ message: 'Ошибка получения ролей' });
    }
});
router.get('/permissions', async (_req, res) => {
    res.json(permissions_1.PERMISSIONS);
});
router.post('/', async (req, res) => {
    try {
        const nameRaw = String(req.body?.name ?? '').trim();
        const copyFromRoleId = req.body?.copyFromRoleId ? String(req.body.copyFromRoleId) : undefined;
        if (!nameRaw) {
            res.status(400).json({ message: 'Название роли обязательно' });
            return;
        }
        const existsByName = await role_model_1.Role.findOne({ name: nameRaw });
        if (existsByName) {
            res.status(400).json({ message: 'Роль с таким названием уже существует' });
            return;
        }
        const generatedKey = createRoleKey(nameRaw);
        if (!generatedKey) {
            res.status(400).json({ message: 'Не удалось сформировать key роли' });
            return;
        }
        const existsByKey = await role_model_1.Role.findOne({ key: generatedKey });
        if (existsByKey) {
            res.status(400).json({ message: 'Роль с таким key уже существует, измените название' });
            return;
        }
        let permissions = [];
        if (copyFromRoleId) {
            const source = await role_model_1.Role.findById(copyFromRoleId).select('permissions');
            if (!source) {
                res.status(404).json({ message: 'Роль для копирования не найдена' });
                return;
            }
            permissions = source.permissions;
        }
        const role = await role_model_1.Role.create({
            name: nameRaw,
            key: generatedKey,
            isSystem: false,
            permissions: (0, permissions_1.normalizePermissions)(permissions)
        });
        res.status(201).json(role);
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Ошибка создания роли' });
    }
});
router.put('/:id/name', async (req, res) => {
    try {
        const nameRaw = String(req.body?.name ?? '').trim();
        if (!nameRaw) {
            res.status(400).json({ message: 'Название роли обязательно' });
            return;
        }
        const role = await role_model_1.Role.findById(req.params.id);
        if (!role) {
            res.status(404).json({ message: 'Роль не найдена' });
            return;
        }
        const duplicate = await role_model_1.Role.findOne({ name: nameRaw, _id: { $ne: role._id } }).lean();
        if (duplicate) {
            res.status(400).json({ message: 'Роль с таким названием уже существует' });
            return;
        }
        role.name = nameRaw;
        await role.save();
        res.json(role);
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Ошибка обновления названия роли' });
    }
});
router.put('/:id/permissions', async (req, res) => {
    try {
        const role = await role_model_1.Role.findById(req.params.id);
        if (!role) {
            res.status(404).json({ message: 'Роль не найдена' });
            return;
        }
        if (role.isSystem && permissions_1.READONLY_SYSTEM_ROLE_KEYS.includes(role.key)) {
            res.status(403).json({ message: 'Права системной роли нельзя изменить' });
            return;
        }
        const permissions = (0, permissions_1.normalizePermissions)(req.body?.permissions);
        role.permissions = permissions;
        await role.save();
        res.json(role);
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Ошибка обновления permissions роли' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const role = await role_model_1.Role.findById(req.params.id);
        if (!role) {
            res.status(404).json({ message: 'Роль не найдена' });
            return;
        }
        if (role.isSystem || permissions_1.SYSTEM_ROLE_KEYS.includes(role.key)) {
            res.status(400).json({ message: 'Системные роли нельзя удалить' });
            return;
        }
        await usersService.reassignUsersFromRole(role._id.toString(), 'manager');
        await role_model_1.Role.deleteOne({ _id: role._id });
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Ошибка удаления роли' });
    }
});
exports.default = router;

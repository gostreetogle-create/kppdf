"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_model_1 = require("../models/user.model");
const role_model_1 = require("../models/role.model");
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_service_1 = require("../auth/auth.service");
const router = (0, express_1.Router)();
const authService = new auth_service_1.AuthService();
function signAccessToken(payload) {
    return authService.signAccessToken(payload);
}
function signRefreshToken(payload) {
    return authService.signRefreshToken(payload);
}
function toSafeUser(user) {
    const roleDoc = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
    const roleKey = roleDoc?.key ?? user.role ?? 'manager';
    const permissions = Array.isArray(roleDoc?.permissions) ? roleDoc.permissions : [];
    return {
        _id: user._id,
        username: user.username,
        name: user.name,
        roleId: roleDoc?._id?.toString?.() ?? user.roleId?.toString?.() ?? null,
        roleKey,
        roleName: roleDoc?.name ?? roleKey,
        permissions,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt
    };
}
// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        res.status(400).json({ message: 'Логин и пароль обязательны' });
        return;
    }
    try {
        const normalizedUsername = username.toLowerCase().trim();
        const user = await user_model_1.User.findOne({ username: normalizedUsername });
        if (!user) {
            res.status(401).json({ message: 'Неверный логин или пароль' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ message: 'Пользователь деактивирован' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ message: 'Неверный логин или пароль' });
            return;
        }
        const roleDoc = await role_model_1.Role.findById(user.roleId).select('key permissions name');
        if (!roleDoc) {
            res.status(400).json({ message: 'Роль пользователя не найдена' });
            return;
        }
        const payload = {
            userId: user._id.toString(),
            username: user.username,
            roleId: roleDoc._id.toString(),
            roleKey: roleDoc.key,
            permissions: roleDoc.permissions
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        user.refreshTokenHash = await authService.hashToken(refreshToken);
        user.refreshTokenExpiresAt = new Date(Date.now() + authService.refreshTtlMs);
        await user.save();
        res.json({
            accessToken,
            refreshToken,
            user: toSafeUser({ ...user.toObject(), roleId: roleDoc })
        });
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// POST /api/auth/logout
router.post('/logout', auth_middleware_1.authGuard, async (req, res) => {
    if (req.user?.isGuest) {
        res.json({ message: 'Гостевая сессия завершена' });
        return;
    }
    try {
        await user_model_1.User.findByIdAndUpdate(req.user.userId, {
            refreshTokenHash: null,
            refreshTokenExpiresAt: null
        });
        res.json({ message: 'Выход выполнен' });
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken обязателен' });
        return;
    }
    try {
        const payload = authService.verifyToken(refreshToken);
        if (payload.type !== 'refresh') {
            res.status(401).json({ message: 'Неверный тип токена' });
            return;
        }
        const user = await user_model_1.User.findById(payload.userId).populate('roleId', 'key permissions name');
        if (!user || !user.isActive || !user.refreshTokenHash) {
            res.status(401).json({ message: 'Сессия не найдена' });
            return;
        }
        if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
            res.status(401).json({ message: 'Сессия истекла' });
            return;
        }
        const matches = await authService.compareToken(refreshToken, user.refreshTokenHash);
        if (!matches) {
            res.status(401).json({ message: 'Сессия невалидна' });
            return;
        }
        const roleDoc = user.roleId ?? await role_model_1.Role.findById(user.roleId).select('key permissions name');
        if (!roleDoc) {
            res.status(400).json({ message: 'Роль пользователя не найдена' });
            return;
        }
        const nextPayload = {
            userId: user._id.toString(),
            username: user.username,
            roleId: roleDoc._id.toString(),
            roleKey: roleDoc.key,
            permissions: roleDoc.permissions
        };
        const nextAccessToken = signAccessToken(nextPayload);
        const nextRefreshToken = signRefreshToken(nextPayload);
        user.refreshTokenHash = await authService.hashToken(nextRefreshToken);
        user.refreshTokenExpiresAt = new Date(Date.now() + authService.refreshTtlMs);
        await user.save();
        res.json({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
    }
    catch {
        res.status(401).json({ message: 'refreshToken недействителен' });
    }
});
// POST /api/auth/change-password
router.post('/change-password', auth_middleware_1.authGuard, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
        res.status(400).json({ message: 'Укажите текущий пароль и новый пароль (минимум 8 символов)' });
        return;
    }
    try {
        const user = await user_model_1.User.findById(req.user.userId);
        if (!user) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!valid) {
            res.status(400).json({ message: 'Текущий пароль неверный' });
            return;
        }
        user.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        user.mustChangePassword = false;
        user.updatedBy = user._id.toString();
        await user.save();
        res.json({ message: 'Пароль обновлён' });
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// GET /api/auth/me
router.get('/me', auth_middleware_1.authGuard, async (req, res) => {
    if (req.user?.isGuest) {
        res.json({
            _id: 'guest-preview',
            username: 'guest',
            name: 'Гостевой просмотр',
            roleId: null,
            roleKey: 'guest',
            roleName: 'Гость',
            permissions: req.user.permissions ?? [],
            isActive: true,
            mustChangePassword: false,
            createdAt: new Date().toISOString()
        });
        return;
    }
    try {
        const user = await user_model_1.User.findById(req.user.userId)
            .select('-passwordHash -refreshTokenHash')
            .populate('roleId', 'key permissions name');
        if (!user) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ message: 'Пользователь деактивирован' });
            return;
        }
        res.json(toSafeUser(user));
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = authGuard;
exports.guestReadonlyGuard = guestReadonlyGuard;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
exports.enforcePasswordChange = enforcePasswordChange;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const role_model_1 = require("../models/role.model");
function authGuard(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Не авторизован' });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'dev-secret');
        if (payload.type && payload.type !== 'access') {
            res.status(401).json({ message: 'Неверный тип токена' });
            return;
        }
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ message: 'Токен недействителен или истёк' });
    }
}
function guestReadonlyGuard(req, res, next) {
    if (req.user?.isGuest && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        res.status(403).json({ message: 'Гостевой доступ только для просмотра' });
        return;
    }
    next();
}
function requireRole(...allowed) {
    return (req, res, next) => {
        const role = req.user?.roleKey;
        if (!role) {
            res.status(401).json({ message: 'Не авторизован' });
            return;
        }
        if (!allowed.includes(role)) {
            res.status(403).json({ message: 'Недостаточно прав' });
            return;
        }
        next();
    };
}
function requirePermission(permission) {
    return async (req, res, next) => {
        const authUser = req.user;
        if (authUser?.isGuest) {
            if (!authUser.permissions.includes(permission)) {
                res.status(403).json({ message: 'Недостаточно прав' });
                return;
            }
            next();
            return;
        }
        const userId = authUser?.userId;
        if (!userId) {
            res.status(401).json({ message: 'Не авторизован' });
            return;
        }
        const user = await user_model_1.User.findById(userId).select('roleId isActive').lean();
        if (!user || user.isActive === false) {
            res.status(401).json({ message: 'Пользователь деактивирован или не найден' });
            return;
        }
        let permissions = authUser?.permissions;
        if (!permissions?.length) {
            const role = user.roleId ? await role_model_1.Role.findById(user.roleId).select('permissions key').lean() : null;
            permissions = (role?.permissions ?? []);
            if (req.user) {
                req.user.permissions = permissions;
                req.user.roleId = user.roleId?.toString() ?? '';
                req.user.roleKey = role?.key ?? 'manager';
            }
        }
        if (!permissions.includes(permission)) {
            res.status(403).json({ message: 'Недостаточно прав' });
            return;
        }
        next();
    };
}
async function enforcePasswordChange(req, res, next) {
    if (req.user?.isGuest) {
        next();
        return;
    }
    if (process.env.ENFORCE_PASSWORD_CHANGE !== 'true') {
        next();
        return;
    }
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Не авторизован' });
        return;
    }
    // Read-only requests stay available, so user can open app and reach password change flow.
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        next();
        return;
    }
    const user = await user_model_1.User.findById(userId).select('mustChangePassword').lean();
    if (!user) {
        res.status(401).json({ message: 'Пользователь не найден' });
        return;
    }
    if (user.mustChangePassword) {
        res.status(403).json({ message: 'Требуется смена пароля' });
        return;
    }
    next();
}

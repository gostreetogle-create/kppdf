"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_service_1 = require("../auth/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_1 = require("../auth/permissions");
const router = (0, express_1.Router)();
const authService = new auth_service_1.AuthService();
const PREVIEW_LINK_TTL_SECONDS = 7 * 24 * 60 * 60;
const PREVIEW_ACCESS_PERMISSIONS = [...permissions_1.ALL_PERMISSION_KEYS];
function previewSecret() {
    return process.env.GUEST_PREVIEW_SECRET || process.env.JWT_SECRET || 'dev-secret';
}
function frontendBaseUrl() {
    return process.env.FRONTEND_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:4200';
}
router.post('/issue', auth_middleware_1.authGuard, (0, auth_middleware_1.requirePermission)('users.manage'), (req, res) => {
    const rawTtlDays = Number(req.body?.ttlDays);
    const ttlDays = Number.isFinite(rawTtlDays) && rawTtlDays > 0 ? Math.min(rawTtlDays, 30) : 7;
    const expiresIn = Math.round(ttlDays * 24 * 60 * 60);
    const linkToken = jsonwebtoken_1.default.sign({
        type: 'guest-preview-link',
        createdBy: req.user?.userId ?? 'system'
    }, previewSecret(), { expiresIn });
    const previewUrl = `${frontendBaseUrl().replace(/\/+$/, '')}/guest-preview/${linkToken}`;
    res.json({
        previewUrl,
        expiresInSeconds: expiresIn
    });
});
router.post('/enter/:token', (req, res) => {
    const token = req.params.token;
    if (!token) {
        res.status(400).json({ message: 'Токен приглашения не указан' });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, previewSecret());
        if (payload.type !== 'guest-preview-link') {
            res.status(401).json({ message: 'Неверный тип приглашения' });
            return;
        }
        const authPayload = {
            userId: 'guest-preview',
            username: 'guest',
            roleId: 'guest-preview',
            roleKey: 'guest',
            permissions: PREVIEW_ACCESS_PERMISSIONS,
            isGuest: true
        };
        const accessToken = authService.signAccessToken(authPayload);
        res.json({
            accessToken,
            user: {
                _id: 'guest-preview',
                username: 'guest',
                name: 'Гостевой просмотр',
                roleId: null,
                roleKey: 'guest',
                roleName: 'Гость',
                permissions: PREVIEW_ACCESS_PERMISSIONS,
                isActive: true,
                mustChangePassword: false
            }
        });
    }
    catch {
        res.status(401).json({ message: 'Ссылка гостевого доступа недействительна или истекла' });
    }
});
exports.default = router;

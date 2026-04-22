"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../models/user.model");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '7d';
// Простой rate limiter — не более 10 попыток за 15 минут с одного IP
const loginAttempts = new Map();
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
        return true;
    }
    if (entry.count >= 10)
        return false;
    entry.count++;
    return true;
}
// POST /api/auth/login
router.post('/login', async (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRateLimit(ip)) {
        res.status(429).json({ message: 'Слишком много попыток. Подождите 15 минут.' });
        return;
    }
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        res.status(400).json({ message: 'Email и пароль обязательны' });
        return;
    }
    try {
        const user = await user_model_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            res.status(401).json({ message: 'Неверный email или пароль' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ message: 'Неверный email или пароль' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET(), { expiresIn: JWT_EXPIRES });
        res.json({
            token,
            user: { _id: user._id, email: user.email, name: user.name, role: user.role }
        });
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// POST /api/auth/logout
router.post('/logout', (_req, res) => {
    res.json({ message: 'Выход выполнен' });
});
// GET /api/auth/me
router.get('/me', auth_middleware_1.authGuard, async (req, res) => {
    try {
        const user = await user_model_1.User.findById(req.user.userId).select('-passwordHash');
        if (!user) {
            res.status(404).json({ message: 'Пользователь не найден' });
            return;
        }
        res.json(user);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
exports.default = router;

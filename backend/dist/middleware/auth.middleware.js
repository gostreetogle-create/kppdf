"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authGuard = authGuard;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authGuard(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Не авторизован' });
        return;
    }
    const token = header.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'dev-secret');
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ message: 'Токен недействителен или истёк' });
    }
}
function requireRole(...allowed) {
    return (req, res, next) => {
        const role = req.user?.role;
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

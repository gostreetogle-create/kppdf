"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL_SECONDS = parseDurationSeconds(process.env.JWT_ACCESS_EXPIRES, 15 * 60);
const REFRESH_TTL_SECONDS = parseDurationSeconds(process.env.JWT_REFRESH_EXPIRES, 7 * 24 * 60 * 60);
function parseDurationSeconds(raw, fallbackSeconds) {
    if (!raw?.trim())
        return fallbackSeconds;
    const normalized = raw.trim().toLowerCase();
    const direct = Number(normalized);
    if (Number.isFinite(direct) && direct > 0)
        return direct;
    const match = normalized.match(/^(\d+)([smhd])$/);
    if (!match)
        return fallbackSeconds;
    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value) || value <= 0)
        return fallbackSeconds;
    const unitToSeconds = {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 24 * 60 * 60
    };
    return value * unitToSeconds[unit];
}
class AuthService {
    signAccessToken(payload) {
        return jsonwebtoken_1.default.sign({ ...payload, type: 'access' }, JWT_SECRET(), { expiresIn: ACCESS_TTL_SECONDS });
    }
    signRefreshToken(payload) {
        return jsonwebtoken_1.default.sign({ ...payload, type: 'refresh' }, JWT_SECRET(), { expiresIn: REFRESH_TTL_SECONDS });
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET());
    }
    async hashToken(token) {
        return bcryptjs_1.default.hash(token, 10);
    }
    async compareToken(rawToken, hash) {
        return bcryptjs_1.default.compare(rawToken, hash);
    }
    get refreshTtlMs() {
        return REFRESH_TTL_SECONDS * 1000;
    }
}
exports.AuthService = AuthService;

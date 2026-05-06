"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const product_spec_routes_1 = __importDefault(require("./routes/product-spec.routes"));
const kp_routes_1 = __importDefault(require("./routes/kp.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const counterparty_routes_1 = __importDefault(require("./routes/counterparty.routes"));
const dictionary_routes_1 = __importDefault(require("./routes/dictionary.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const roles_routes_1 = __importDefault(require("./routes/roles.routes"));
const permissions_routes_1 = __importDefault(require("./routes/permissions.routes"));
const guest_routes_1 = __importDefault(require("./routes/guest.routes"));
const auth_middleware_1 = require("./middleware/auth.middleware");
const rbac_guard_1 = require("./middleware/rbac.guard");
const role_init_service_1 = require("./services/role-init.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
app.use('/media', express_1.default.static(mediaRoot));
// Backward-compatible aliases for old stored links.
app.use('/products', express_1.default.static(path_1.default.join(mediaRoot, 'products')));
app.use('/kp', express_1.default.static(path_1.default.join(mediaRoot, 'kp')));
// Логирование запросов
app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.url}`);
    next();
});
// Health check (публичный, для deploy.sh и мониторинга)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});
// Version endpoint — регистрируем ДО /api/*, чтобы не требовал авторизации
app.get('/api/version', (_req, res) => {
    let commit = process.env.GIT_COMMIT;
    if (!commit || commit.startsWith('$(')) {
        try {
            const { execSync } = require('child_process');
            commit = execSync('git rev-parse --short HEAD', { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
        }
        catch {
            commit = 'unknown';
        }
    }
    res.json({ commit, time: new Date().toISOString() });
});
const loginAttempts = new Map();
app.use('/api/auth/login', (req, res, next) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
        next();
        return;
    }
    if (entry.count >= 10) {
        res.status(429).json({ message: 'Слишком много попыток. Подождите 15 минут.' });
        return;
    }
    entry.count++;
    next();
});
// Публичные роуты
app.use('/api/auth', auth_routes_1.default);
app.use('/api/guest', guest_routes_1.default);
// Защищённые роуты
app.use('/api/settings', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, settings_routes_1.default);
app.use('/api/dictionaries', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, dictionary_routes_1.default);
app.use('/api/counterparties', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, counterparty_routes_1.default);
app.use('/api/products', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, product_routes_1.default);
app.use('/api/product-specs', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, product_spec_routes_1.default);
app.use('/api/kp', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, kp_routes_1.default);
app.use('/api/users', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, (0, rbac_guard_1.requirePermission)('users.manage'), users_routes_1.default);
app.use('/api/roles', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, (0, rbac_guard_1.requirePermission)('users.manage'), roles_routes_1.default);
app.use('/api/permissions', auth_middleware_1.authGuard, auth_middleware_1.guestReadonlyGuard, auth_middleware_1.enforcePasswordChange, (0, rbac_guard_1.requirePermission)('users.manage'), permissions_routes_1.default);
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';
mongoose_1.default.connect(MONGO_URI)
    .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    return (0, role_init_service_1.initRolesAndMigrateUsers)();
})
    .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
})
    .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});

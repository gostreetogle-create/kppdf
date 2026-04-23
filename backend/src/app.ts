import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import productRoutes from './routes/product.routes';
import productSpecRoutes from './routes/product-spec.routes';
import kpRoutes from './routes/kp.routes';
import authRoutes from './routes/auth.routes';
import counterpartyRoutes from './routes/counterparty.routes';
import dictionaryRoutes from './routes/dictionary.routes';
import settingsRoutes from './routes/settings.routes';
import usersRoutes from './routes/users.routes';
import rolesRoutes from './routes/roles.routes';
import permissionsRoutes from './routes/permissions.routes';
import guestRoutes from './routes/guest.routes';
import { authGuard, enforcePasswordChange, guestReadonlyGuard } from './middleware/auth.middleware';
import { requirePermission } from './middleware/rbac.guard';
import { initRolesAndMigrateUsers } from './services/role-init.service';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
app.use('/media', express.static(mediaRoot));
// Backward-compatible aliases for old stored links.
app.use('/products', express.static(path.join(mediaRoot, 'products')));
app.use('/kp', express.static(path.join(mediaRoot, 'kp')));

// Логирование запросов
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.url}`);
  next();
});

// Health check (публичный, для deploy.sh и мониторинга)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
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
app.use('/api/auth', authRoutes);
app.use('/api/guest', guestRoutes);

// Защищённые роуты
app.use('/api/settings',        authGuard, guestReadonlyGuard, enforcePasswordChange, settingsRoutes);
app.use('/api/dictionaries',    authGuard, guestReadonlyGuard, enforcePasswordChange, dictionaryRoutes);
app.use('/api/counterparties',  authGuard, guestReadonlyGuard, enforcePasswordChange, counterpartyRoutes);
app.use('/api/products',        authGuard, guestReadonlyGuard, enforcePasswordChange, productRoutes);
app.use('/api/product-specs',   authGuard, guestReadonlyGuard, enforcePasswordChange, productSpecRoutes);
app.use('/api/kp',              authGuard, guestReadonlyGuard, enforcePasswordChange, kpRoutes);
app.use('/api/users',           authGuard, guestReadonlyGuard, enforcePasswordChange, requirePermission('users.manage'), usersRoutes);
app.use('/api/roles',           authGuard, guestReadonlyGuard, enforcePasswordChange, requirePermission('users.manage'), rolesRoutes);
app.use('/api/permissions',     authGuard, guestReadonlyGuard, enforcePasswordChange, requirePermission('users.manage'), permissionsRoutes);

const PORT     = process.env.PORT     || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    return initRolesAndMigrateUsers();
  })
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

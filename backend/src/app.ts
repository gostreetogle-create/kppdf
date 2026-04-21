import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import productRoutes from './routes/product.routes';
import kpRoutes from './routes/kp.routes';
import authRoutes from './routes/auth.routes';
import counterpartyRoutes from './routes/counterparty.routes';
import dictionaryRoutes from './routes/dictionary.routes';
import settingsRoutes from './routes/settings.routes';
import { authGuard, requireRole } from './middleware/auth.middleware';

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

// Публичные роуты
app.use('/api/auth', authRoutes);

// Защищённые роуты
app.use('/api/settings',        authGuard, requireRole('admin'), settingsRoutes);
app.use('/api/dictionaries',    authGuard, requireRole('admin'), dictionaryRoutes);
app.use('/api/counterparties',  authGuard, counterpartyRoutes);
app.use('/api/products',        authGuard, productRoutes);
app.use('/api/kp',              authGuard, kpRoutes);

const PORT     = process.env.PORT     || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

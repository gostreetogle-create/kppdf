import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import productRoutes from './routes/product.routes';
import kpRoutes from './routes/kp.routes';
import authRoutes from './routes/auth.routes';
import counterpartyRoutes from './routes/counterparty.routes';
import dictionaryRoutes from './routes/dictionary.routes';
import settingsRoutes from './routes/settings.routes';
import { authGuard } from './middleware/auth.middleware';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());

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
app.use('/api/settings',        authGuard, settingsRoutes);
app.use('/api/dictionaries',    authGuard, dictionaryRoutes);
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

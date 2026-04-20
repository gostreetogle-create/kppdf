import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { authGuard } from '../middleware/auth.middleware';

const router = Router();
const JWT_SECRET  = () => process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES = '7d';

// Простой rate limiter — не более 10 попыток за 15 минут с одного IP
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
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
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ message: 'Неверный email или пароль' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Неверный email или пароль' });
      return;
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET(),
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      user: { _id: user._id, email: user.email, name: user.name, role: user.role }
    });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Выход выполнен' });
});

// GET /api/auth/me
router.get('/me', authGuard, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) { res.status(404).json({ message: 'Пользователь не найден' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;

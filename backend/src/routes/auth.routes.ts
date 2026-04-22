import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { authGuard } from '../middleware/auth.middleware';
import type { AuthPayload } from '../middleware/auth.middleware';
import { AuthService } from '../auth/auth.service';

const router = Router();
const authService = new AuthService();

function signAccessToken(payload: Omit<AuthPayload, 'type'>): string {
  return authService.signAccessToken(payload);
}

function signRefreshToken(payload: Omit<AuthPayload, 'type'>): string {
  return authService.signRefreshToken(payload);
}

function toSafeUser(user: any) {
  const roleDoc = user.roleId && typeof user.roleId === 'object' ? user.roleId : null;
  const roleKey = roleDoc?.key ?? user.role ?? 'manager';
  const permissions = Array.isArray(roleDoc?.permissions) ? roleDoc.permissions : [];
  return {
    _id: user._id,
    username: user.username,
    name: user.name,
    roleId: roleDoc?._id?.toString?.() ?? user.roleId?.toString?.() ?? null,
    roleKey,
    roleName: roleDoc?.name ?? roleKey,
    permissions,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt
  };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ message: 'Логин и пароль обязательны' });
    return;
  }

  try {
    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      res.status(401).json({ message: 'Неверный логин или пароль' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: 'Пользователь деактивирован' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Неверный логин или пароль' });
      return;
    }

    const roleDoc = await Role.findById(user.roleId).select('key permissions name');
    if (!roleDoc) {
      res.status(400).json({ message: 'Роль пользователя не найдена' });
      return;
    }
    const payload = {
      userId: user._id.toString(),
      username: user.username,
      roleId: roleDoc._id.toString(),
      roleKey: roleDoc.key,
      permissions: roleDoc.permissions
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    user.refreshTokenHash = await authService.hashToken(refreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + authService.refreshTtlMs);
    await user.save();

    res.json({
      accessToken,
      refreshToken,
      user: toSafeUser({ ...user.toObject(), roleId: roleDoc })
    });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/auth/logout
router.post('/logout', authGuard, async (req: Request, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.user!.userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null
    });
    res.json({ message: 'Выход выполнен' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ message: 'refreshToken обязателен' });
    return;
  }
  try {
    const payload = authService.verifyToken<AuthPayload>(refreshToken);
    if (payload.type !== 'refresh') {
      res.status(401).json({ message: 'Неверный тип токена' });
      return;
    }
    const user = await User.findById(payload.userId).populate('roleId', 'key permissions name');
    if (!user || !user.isActive || !user.refreshTokenHash) {
      res.status(401).json({ message: 'Сессия не найдена' });
      return;
    }
    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
      res.status(401).json({ message: 'Сессия истекла' });
      return;
    }

    const matches = await authService.compareToken(refreshToken, user.refreshTokenHash);
    if (!matches) {
      res.status(401).json({ message: 'Сессия невалидна' });
      return;
    }

    const roleDoc = (user as any).roleId ?? await Role.findById(user.roleId).select('key permissions name');
    if (!roleDoc) {
      res.status(400).json({ message: 'Роль пользователя не найдена' });
      return;
    }
    const nextPayload = {
      userId: user._id.toString(),
      username: user.username,
      roleId: roleDoc._id.toString(),
      roleKey: roleDoc.key,
      permissions: roleDoc.permissions
    };
    const nextAccessToken = signAccessToken(nextPayload);
    const nextRefreshToken = signRefreshToken(nextPayload);
    user.refreshTokenHash = await authService.hashToken(nextRefreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + authService.refreshTtlMs);
    await user.save();

    res.json({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
  } catch {
    res.status(401).json({ message: 'refreshToken недействителен' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authGuard, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ message: 'Укажите текущий пароль и новый пароль (минимум 8 символов)' });
    return;
  }
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ message: 'Текущий пароль неверный' });
      return;
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.updatedBy = user._id.toString();
    await user.save();
    res.json({ message: 'Пароль обновлён' });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/auth/me
router.get('/me', authGuard, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId)
      .select('-passwordHash -refreshTokenHash')
      .populate('roleId', 'key permissions name');
    if (!user) { res.status(404).json({ message: 'Пользователь не найден' }); return; }
    if (!user.isActive) {
      res.status(403).json({ message: 'Пользователь деактивирован' });
      return;
    }
    res.json(toSafeUser(user));
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

export default router;

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { can, type Permission, type UserRole } from '../auth/permissions';

export interface AuthPayload {
  userId: string;
  username: string;
  role: UserRole;
  type?: 'access' | 'refresh';
}

// Расширяем Request чтобы хранить payload
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authGuard(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Не авторизован' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthPayload;
    if (payload.type && payload.type !== 'access') {
      res.status(401).json({ message: 'Неверный тип токена' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Токен недействителен или истёк' });
  }
}

export function requireRole(...allowed: AuthPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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

export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    const user = await User.findById(userId).select('role isActive mustChangePassword').lean();
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Пользователь деактивирован или не найден' });
      return;
    }
    if (!can({ role: user.role, isActive: user.isActive }, permission)) {
      res.status(403).json({ message: 'Недостаточно прав' });
      return;
    }
    next();
  };
}

export async function enforcePasswordChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: 'Не авторизован' });
    return;
  }
  const user = await User.findById(userId).select('mustChangePassword').lean();
  if (!user) {
    res.status(401).json({ message: 'Пользователь не найден' });
    return;
  }
  if (user.mustChangePassword) {
    res.status(403).json({ message: 'Требуется смена пароля' });
    return;
  }
  next();
}

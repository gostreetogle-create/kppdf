import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { type Permission } from '../auth/permissions';

export interface AuthPayload {
  userId: string;
  username: string;
  roleId: string;
  roleKey: string;
  permissions: Permission[];
  type?: 'access' | 'refresh';
  isGuest?: boolean;
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

export function guestReadonlyGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.isGuest && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.status(403).json({ message: 'Гостевой доступ только для просмотра' });
    return;
  }
  next();
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.roleKey as any;
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
    const authUser = req.user;
    if (authUser?.isGuest) {
      if (!authUser.permissions.includes(permission)) {
        res.status(403).json({ message: 'Недостаточно прав' });
        return;
      }
      next();
      return;
    }
    const userId = authUser?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    const user = await User.findById(userId).select('roleId isActive').lean();
    if (!user || user.isActive === false) {
      res.status(401).json({ message: 'Пользователь деактивирован или не найден' });
      return;
    }

    let permissions = authUser?.permissions;
    if (!permissions?.length) {
      const role = user.roleId ? await Role.findById(user.roleId).select('permissions key').lean() : null;
      permissions = (role?.permissions ?? []) as Permission[];
      if (req.user) {
        req.user.permissions = permissions;
        req.user.roleId = user.roleId?.toString() ?? '';
        req.user.roleKey = role?.key ?? 'manager';
      }
    }

    if (!permissions.includes(permission)) {
      res.status(403).json({ message: 'Недостаточно прав' });
      return;
    }
    next();
  };
}

export async function enforcePasswordChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.isGuest) {
    next();
    return;
  }
  if (process.env.ENFORCE_PASSWORD_CHANGE !== 'true') {
    next();
    return;
  }
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ message: 'Не авторизован' });
    return;
  }
  // Read-only requests stay available, so user can open app and reach password change flow.
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
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

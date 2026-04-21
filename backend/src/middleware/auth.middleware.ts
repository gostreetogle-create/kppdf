import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email:  string;
  role:   'admin' | 'manager';
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

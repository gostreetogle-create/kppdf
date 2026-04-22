import type { Request, Response } from 'express';
import { UsersService } from '../services/users.service';
import type { UserRole } from '../auth/permissions';

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  list = async (_req: Request, res: Response) => {
    try {
      const users = await this.usersService.list();
      res.json(users);
    } catch {
      res.status(500).json({ message: 'Ошибка сервера' });
    }
  };

  create = async (req: Request, res: Response) => {
    const { username, name, role, password } = req.body as {
      username?: string;
      name?: string;
      role?: UserRole;
      password?: string;
    };
    if (!username || !name || !role || !password) {
      res.status(400).json({ message: 'username, name, role, password обязательны' });
      return;
    }
    try {
      const user = await this.usersService.create({
        username,
        name,
        role,
        password,
        actorUserId: req.user?.userId
      });
      res.status(201).json({
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt
      });
    } catch (e: any) {
      const duplicateField = e?.keyPattern ? Object.keys(e.keyPattern)[0] : undefined;
      const details = e?.code === 11000
        ? `Конфликт уникального поля: ${duplicateField || 'unknown'}`
        : (typeof e?.message === 'string' ? e.message : 'Unknown error');
      res.status(400).json({
        message: e?.message || 'Ошибка создания пользователя',
        details
      });
    }
  };

  patch = async (req: Request, res: Response) => {
    try {
      const user = await this.usersService.update(req.params.id, {
        username: req.body?.username,
        name: req.body?.name,
        role: req.body?.role,
        isActive: req.body?.isActive,
        mustChangePassword: req.body?.mustChangePassword,
        actorUserId: req.user?.userId,
        actorRole: req.user?.role
      });
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'Ошибка обновления пользователя' });
    }
  };

  resetPassword = async (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ message: 'Новый пароль обязателен' });
      return;
    }
    try {
      const result = await this.usersService.resetPassword(req.params.id, password, req.user?.userId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'Ошибка сброса пароля' });
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const result = await this.usersService.delete(req.params.id, req.user?.userId);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e?.message || 'Ошибка удаления пользователя' });
    }
  };
}


import type { Request, Response } from 'express';
import { UsersService } from '../services/users.service';

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
    const { username, name, roleId, password } = req.body as {
      username?: string;
      name?: string;
      roleId?: string;
      password?: string;
    };
    if (!username || !name || !roleId || !password) {
      res.status(400).json({ message: 'username, name, roleId, password обязательны' });
      return;
    }
    try {
      const user = await this.usersService.create({
        username,
        name,
        roleId,
        password,
        actorUserId: req.user?.userId
      });
      res.status(201).json({
        _id: user._id,
        username: user.username,
        name: user.name,
        roleId: (user as any).roleId?._id?.toString?.() ?? user.roleId,
        roleKey: (user as any).roleId?.key ?? (user as any).role,
        roleName: (user as any).roleId?.name ?? (user as any).role,
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
        roleId: req.body?.roleId,
        isActive: req.body?.isActive,
        mustChangePassword: req.body?.mustChangePassword,
        actorUserId: req.user?.userId,
        actorRoleKey: req.user?.roleKey
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


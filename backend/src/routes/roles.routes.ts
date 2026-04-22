import { Router, Request, Response } from 'express';
import { Role } from '../models/role.model';
import { normalizePermissions, PERMISSIONS, READONLY_SYSTEM_ROLE_KEYS, SYSTEM_ROLE_KEYS } from '../auth/permissions';
import { UsersService } from '../services/users.service';

const router = Router();
const usersService = new UsersService();

function createRoleKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .replace(/_+/g, '_');
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 });
    res.json(roles);
  } catch {
    res.status(500).json({ message: 'Ошибка получения ролей' });
  }
});

router.get('/permissions', async (_req: Request, res: Response) => {
  res.json(PERMISSIONS);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const nameRaw = String(req.body?.name ?? '').trim();
    const copyFromRoleId = req.body?.copyFromRoleId ? String(req.body.copyFromRoleId) : undefined;
    if (!nameRaw) {
      res.status(400).json({ message: 'Название роли обязательно' });
      return;
    }
    const existsByName = await Role.findOne({ name: nameRaw });
    if (existsByName) {
      res.status(400).json({ message: 'Роль с таким названием уже существует' });
      return;
    }
    const generatedKey = createRoleKey(nameRaw);
    if (!generatedKey) {
      res.status(400).json({ message: 'Не удалось сформировать key роли' });
      return;
    }
    const existsByKey = await Role.findOne({ key: generatedKey });
    if (existsByKey) {
      res.status(400).json({ message: 'Роль с таким key уже существует, измените название' });
      return;
    }
    let permissions: string[] = [];
    if (copyFromRoleId) {
      const source = await Role.findById(copyFromRoleId).select('permissions');
      if (!source) {
        res.status(404).json({ message: 'Роль для копирования не найдена' });
        return;
      }
      permissions = source.permissions;
    }
    const role = await Role.create({
      name: nameRaw,
      key: generatedKey,
      isSystem: false,
      permissions: normalizePermissions(permissions)
    });
    res.status(201).json(role);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Ошибка создания роли' });
  }
});

router.put('/:id/name', async (req: Request, res: Response) => {
  try {
    const nameRaw = String(req.body?.name ?? '').trim();
    if (!nameRaw) {
      res.status(400).json({ message: 'Название роли обязательно' });
      return;
    }
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: 'Роль не найдена' });
      return;
    }
    const duplicate = await Role.findOne({ name: nameRaw, _id: { $ne: role._id } }).lean();
    if (duplicate) {
      res.status(400).json({ message: 'Роль с таким названием уже существует' });
      return;
    }
    role.name = nameRaw;
    await role.save();
    res.json(role);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Ошибка обновления названия роли' });
  }
});

router.put('/:id/permissions', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: 'Роль не найдена' });
      return;
    }
    if (role.isSystem && READONLY_SYSTEM_ROLE_KEYS.includes(role.key as any)) {
      res.status(403).json({ message: 'Права системной роли нельзя изменить' });
      return;
    }
    const permissions = normalizePermissions(req.body?.permissions);
    role.permissions = permissions;
    await role.save();
    res.json(role);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Ошибка обновления permissions роли' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      res.status(404).json({ message: 'Роль не найдена' });
      return;
    }
    if (role.isSystem || (SYSTEM_ROLE_KEYS as readonly string[]).includes(role.key)) {
      res.status(400).json({ message: 'Системные роли нельзя удалить' });
      return;
    }
    await usersService.reassignUsersFromRole(role._id.toString(), 'manager');
    await Role.deleteOne({ _id: role._id });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Ошибка удаления роли' });
  }
});

export default router;

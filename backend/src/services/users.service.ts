import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Role } from '../models/role.model';
import { SYSTEM_ROLE_KEYS } from '../auth/permissions';

let legacyEmailIndexChecked = false;

async function ensureLegacyUserIndexes() {
  if (legacyEmailIndexChecked) return;
  legacyEmailIndexChecked = true;
  try {
    const indexes = await User.collection.indexes();
    const hasLegacyEmailIndex = indexes.some(index => index.name === 'email_1');
    if (hasLegacyEmailIndex) {
      await User.collection.dropIndex('email_1');
    }
  } catch {
    // noop: index may already be absent or collection not ready yet.
  }
}

export interface CreateUserInput {
  username: string;
  name: string;
  roleId: string;
  password: string;
  actorUserId?: string;
}

export interface UpdateUserInput {
  username?: string;
  name?: string;
  roleId?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
  actorUserId?: string;
  actorRoleKey?: string;
}

export class UsersService {
  async list() {
    const users = await User.find()
      .select('-passwordHash -refreshTokenHash')
      .populate('roleId', 'name key isSystem permissions')
      .sort({ createdAt: -1 });
    return users.map((user: any) => ({
      _id: user._id,
      username: user.username,
      name: user.name,
      roleId: user.roleId?._id?.toString() ?? null,
      roleKey: user.roleId?.key ?? user.role ?? 'manager',
      roleName: user.roleId?.name ?? user.role ?? 'manager',
      isSystemRole: Boolean(user.roleId?.isSystem),
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt
    }));
  }

  async create(input: CreateUserInput) {
    await ensureLegacyUserIndexes();

    const normalizedUsername = input.username.toLowerCase().trim();
    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
      throw new Error('Пользователь с таким логином уже существует');
    }
    const role = await Role.findById(input.roleId).select('_id key');
    if (!role) throw new Error('Роль не найдена');
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      name: input.name.trim(),
      roleId: role._id,
      role: role.key,
      isActive: true,
      mustChangePassword: true,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null
    });
    return user;
  }

  async update(userId: string, patch: UpdateUserInput) {
    const actor = patch.actorUserId ? await User.findById(patch.actorUserId).select('role roleId').populate('roleId', 'key') : null;
    const actorRoleKey = (actor as any)?.roleId?.key ?? actor?.role ?? patch.actorRoleKey;
    if (typeof patch.username === 'string' && actorRoleKey === 'owner' && patch.actorUserId === userId) {
      throw new Error('Владелец не может менять свой логин');
    }

    if (typeof patch.username === 'string') {
      const normalizedUsername = patch.username.toLowerCase().trim();
      if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
        throw new Error('Логин: 3-32 символа, только латиница/цифры/._-');
      }
      const existing = await User.findOne({ username: normalizedUsername, _id: { $ne: userId } });
      if (existing) {
        throw new Error('Пользователь с таким логином уже существует');
      }
      patch.username = normalizedUsername;
    }

    const updateDoc: Record<string, unknown> = { updatedBy: patch.actorUserId ?? null };
    if (typeof patch.username === 'string') updateDoc['username'] = patch.username;
    if (typeof patch.name === 'string') updateDoc['name'] = patch.name.trim();
    if (typeof patch.roleId === 'string' && patch.roleId) {
      const role = await Role.findById(patch.roleId).select('_id key');
      if (!role) throw new Error('Роль не найдена');
      updateDoc['roleId'] = role._id;
      updateDoc['role'] = role.key;
    }
    if (typeof patch.isActive === 'boolean') updateDoc['isActive'] = patch.isActive;
    if (typeof patch.mustChangePassword === 'boolean') updateDoc['mustChangePassword'] = patch.mustChangePassword;

    const updated = await User.findByIdAndUpdate(userId, updateDoc, { new: true })
      .select('-passwordHash -refreshTokenHash');
    if (!updated) throw new Error('Пользователь не найден');
    const populated = await User.findById(updated._id)
      .select('-passwordHash -refreshTokenHash')
      .populate('roleId', 'name key isSystem permissions');
    if (!populated) throw new Error('Пользователь не найден');
    return {
      _id: populated._id,
      username: populated.username,
      name: populated.name,
      roleId: (populated as any).roleId?._id?.toString() ?? null,
      roleKey: (populated as any).roleId?.key ?? populated.role ?? 'manager',
      roleName: (populated as any).roleId?.name ?? populated.role ?? 'manager',
      isSystemRole: Boolean((populated as any).roleId?.isSystem),
      isActive: populated.isActive,
      mustChangePassword: populated.mustChangePassword,
      createdAt: populated.createdAt
    };
  }

  async resetPassword(userId: string, newPassword: string, actorUserId?: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Пароль должен быть не короче 8 символов');
    }
    const user = await User.findById(userId);
    if (!user) throw new Error('Пользователь не найден');

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = true;
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    user.updatedBy = actorUserId ?? null;
    await user.save();
    return { message: 'Пароль сброшен' };
  }

  async delete(userId: string, actorUserId?: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Пользователь не найден');

    if (actorUserId && user._id.toString() === actorUserId) {
      throw new Error('Нельзя удалить текущего пользователя');
    }

    await User.findByIdAndDelete(userId);
    return { message: 'Пользователь удалён' };
  }

  async reassignUsersFromRole(roleId: string, fallbackRoleKey: (typeof SYSTEM_ROLE_KEYS)[number] = 'manager') {
    const fallbackRole = await Role.findOne({ key: fallbackRoleKey }).select('_id key');
    if (!fallbackRole) throw new Error('Системная роль manager не найдена');
    await User.updateMany(
      { roleId },
      { $set: { roleId: fallbackRole._id, role: fallbackRole.key } }
    );
  }
}


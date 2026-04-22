import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import type { UserRole } from '../auth/permissions';

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
  role: UserRole;
  password: string;
  actorUserId?: string;
}

export interface UpdateUserInput {
  username?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  actorUserId?: string;
  actorRole?: UserRole;
}

export class UsersService {
  async list() {
    return User.find()
      .select('-passwordHash -refreshTokenHash')
      .sort({ createdAt: -1 });
  }

  async create(input: CreateUserInput) {
    await ensureLegacyUserIndexes();

    const normalizedUsername = input.username.toLowerCase().trim();
    const exists = await User.findOne({ username: normalizedUsername });
    if (exists) {
      throw new Error('Пользователь с таким логином уже существует');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await User.create({
      username: normalizedUsername,
      passwordHash,
      name: input.name.trim(),
      role: input.role,
      isActive: true,
      mustChangePassword: true,
      createdBy: input.actorUserId ?? null,
      updatedBy: input.actorUserId ?? null
    });
    return user;
  }

  async update(userId: string, patch: UpdateUserInput) {
    if (typeof patch.username === 'string' && patch.actorRole === 'owner' && patch.actorUserId === userId) {
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
    if (patch.role) updateDoc['role'] = patch.role;
    if (typeof patch.isActive === 'boolean') updateDoc['isActive'] = patch.isActive;
    if (typeof patch.mustChangePassword === 'boolean') updateDoc['mustChangePassword'] = patch.mustChangePassword;

    const updated = await User.findByIdAndUpdate(userId, updateDoc, { new: true })
      .select('-passwordHash -refreshTokenHash');
    if (!updated) throw new Error('Пользователь не найден');
    return updated;
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
}


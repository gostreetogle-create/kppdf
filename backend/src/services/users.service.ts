import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import type { UserRole } from '../auth/permissions';

export interface CreateUserInput {
  username: string;
  name: string;
  role: UserRole;
  password: string;
  actorUserId?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  actorUserId?: string;
}

export class UsersService {
  async list() {
    return User.find()
      .select('-passwordHash -refreshTokenHash')
      .sort({ createdAt: -1 });
  }

  async create(input: CreateUserInput) {
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
    const updateDoc: Record<string, unknown> = { updatedBy: patch.actorUserId ?? null };
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
}


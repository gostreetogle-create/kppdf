import { Types } from 'mongoose';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';
import {
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_PERMISSIONS,
  normalizePermissions,
  type SystemRoleKey
} from '../auth/permissions';

function toObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  return null;
}

export async function initRolesAndMigrateUsers(): Promise<void> {
  const roleByKey = new Map<SystemRoleKey, Types.ObjectId>();

  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const seeded = await Role.findOneAndUpdate(
      { key: roleKey },
      {
        $set: {
          name: roleKey,
          key: roleKey,
          isSystem: true,
          permissions: SYSTEM_ROLE_PERMISSIONS[roleKey]
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    roleByKey.set(roleKey, seeded._id as Types.ObjectId);
  }

  const users = await User.find().select('_id role roleId').lean();
  for (const user of users) {
    const existingRoleId = toObjectId(user.roleId);
    if (existingRoleId) continue;

    const legacyRole = typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
    const mappedKey: SystemRoleKey =
      (SYSTEM_ROLE_KEYS as readonly string[]).includes(legacyRole) ? (legacyRole as SystemRoleKey) : 'manager';
    const mappedRoleId = roleByKey.get(mappedKey);
    if (!mappedRoleId) continue;

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          roleId: mappedRoleId,
          role: mappedKey
        }
      }
    );
  }

  const customRoles = await Role.find({ isSystem: false }).select('_id permissions').lean();
  for (const role of customRoles) {
    const normalized = normalizePermissions(role.permissions as string[]);
    if (normalized.length !== (role.permissions?.length ?? 0)) {
      await Role.updateOne({ _id: role._id }, { $set: { permissions: normalized } });
    }
  }
}

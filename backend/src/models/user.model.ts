import { Schema, model, Document } from 'mongoose';
import { IUser as ISharedUser } from '../../../shared/types/User';

export interface IUser extends Omit<ISharedUser, '_id' | 'roleId' | 'roleKey' | 'roleName' | 'permissions' | 'createdAt' | 'updatedAt'>, Document {
  passwordHash: string;
  roleId:       Schema.Types.ObjectId | string;
  // legacy field kept for compatibility/migration
  role?:        string;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username:     { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true, trim: true },
  roleId:       { type: Schema.Types.ObjectId, ref: 'Role', index: true },
  role:         { type: String, default: undefined },
  isActive:     { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  refreshTokenHash: { type: String, default: null },
  refreshTokenExpiresAt: { type: Date, default: null },
  createdBy:    { type: String, default: null },
  updatedBy:    { type: String, default: null }
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);

import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  username:     string;
  passwordHash: string;
  name:         string;
  roleId:       Schema.Types.ObjectId | string;
  // legacy field kept for compatibility/migration
  role?:        string;
  isActive:     boolean;
  mustChangePassword: boolean;
  refreshTokenHash?: string | null;
  refreshTokenExpiresAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
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

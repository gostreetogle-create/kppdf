import { Schema, model, Document } from 'mongoose';
import type { Permission } from '../auth/permissions';

export interface IRole extends Document {
  name: string;
  key: string;
  isSystem: boolean;
  permissions: Permission[];
  createdAt?: Date;
  updatedAt?: Date;
}

const RoleSchema = new Schema<IRole>({
  name: { type: String, required: true, trim: true, unique: true },
  key: { type: String, required: true, trim: true, unique: true, lowercase: true, index: true },
  isSystem: { type: Boolean, default: false },
  permissions: { type: [String], default: [] }
}, { timestamps: true });

RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ key: 1 }, { unique: true });

export const Role = model<IRole>('Role', RoleSchema);

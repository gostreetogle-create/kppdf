import { Schema, model, Document } from 'mongoose';
import { Permission } from '../../../shared/types/User';

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
  key: { type: String, required: true, trim: true, unique: true, lowercase: true },
  isSystem: { type: Boolean, default: false },
  permissions: { type: [String], default: [] }
}, { timestamps: true });

export const Role = model<IRole>('Role', RoleSchema);

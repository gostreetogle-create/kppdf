import { Schema, model, Document } from 'mongoose';

export type UserRole = 'admin' | 'manager';

export interface IUser extends Document {
  email:        string;
  passwordHash: string;
  name:         string;
  role:         UserRole;
}

const UserSchema = new Schema<IUser>({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, required: true, trim: true },
  role:         { type: String, enum: ['admin', 'manager'], default: 'manager' },
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);

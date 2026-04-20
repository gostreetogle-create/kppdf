import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/user.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';
const EMAIL     = process.env.ADMIN_EMAIL    || 'admin@example.com';
const PASSWORD  = process.env.ADMIN_PASSWORD || 'admin123';
const NAME      = process.env.ADMIN_NAME     || 'Администратор';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    console.log(`ℹ️  Пользователь ${EMAIL} уже существует`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create({ email: EMAIL, passwordHash, name: NAME, role: 'admin' });

  console.log(`✅ Admin создан: ${EMAIL} / ${PASSWORD}`);
  console.log('⚠️  Смените пароль после первого входа!');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

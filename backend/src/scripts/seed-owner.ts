import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/user.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';
const USERNAME = process.env.OWNER_USERNAME || 'owner';
const PASSWORD = process.env.OWNER_PASSWORD || 'owner123456';
const NAME = process.env.OWNER_NAME || 'Владелец';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  const normalizedUsername = USERNAME.toLowerCase().trim();
  const existing = await User.findOne({ username: normalizedUsername });
  if (existing) {
    console.log(`ℹ️  Пользователь ${normalizedUsername} уже существует`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.create({
    username: normalizedUsername,
    passwordHash,
    name: NAME,
    role: 'owner',
    isActive: true,
    mustChangePassword: true
  });

  console.log(`✅ Owner создан: ${normalizedUsername} / ${PASSWORD}`);
  console.log('⚠️  Смените пароль после первого входа!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


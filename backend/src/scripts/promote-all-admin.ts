import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/user.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  const result = await User.updateMany(
    {},
    {
      $set: {
        role: 'admin',
        isActive: true,
        mustChangePassword: false
      }
    }
  );

  console.log(`✅ Users updated: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  console.log('ℹ️  Все пользователи теперь admin (RBAC сохранен, но ограничений для текущих пользователей нет).');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


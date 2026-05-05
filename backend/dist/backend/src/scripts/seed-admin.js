"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const user_model_1 = require("../models/user.model");
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';
const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const NAME = process.env.ADMIN_NAME || 'Администратор';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
    const existing = await user_model_1.User.findOne({ username: USERNAME });
    if (existing) {
        console.log(`ℹ️  Пользователь ${USERNAME} уже существует`);
        await mongoose_1.default.disconnect();
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(PASSWORD, 10);
    await user_model_1.User.create({
        username: USERNAME.toLowerCase().trim(),
        passwordHash,
        name: NAME,
        role: 'admin',
        isActive: true,
        mustChangePassword: false
    });
    console.log(`✅ Admin создан: ${USERNAME} / ${PASSWORD}`);
    console.log('⚠️  Смените пароль после первого входа!');
    await mongoose_1.default.disconnect();
}
run().catch(err => { console.error(err); process.exit(1); });

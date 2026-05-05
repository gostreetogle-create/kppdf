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
const USERNAME = process.env.OWNER_USERNAME || 'owner';
const PASSWORD = process.env.OWNER_PASSWORD || 'owner123456';
const NAME = process.env.OWNER_NAME || 'Владелец';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
    const normalizedUsername = USERNAME.toLowerCase().trim();
    const existing = await user_model_1.User.findOne({ username: normalizedUsername });
    if (existing) {
        console.log(`ℹ️  Пользователь ${normalizedUsername} уже существует`);
        await mongoose_1.default.disconnect();
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(PASSWORD, 10);
    await user_model_1.User.create({
        username: normalizedUsername,
        passwordHash,
        name: NAME,
        role: 'owner',
        isActive: true,
        mustChangePassword: false
    });
    console.log(`✅ Owner создан: ${normalizedUsername} / ${PASSWORD}`);
    console.log('⚠️  Смените пароль после первого входа!');
    await mongoose_1.default.disconnect();
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});

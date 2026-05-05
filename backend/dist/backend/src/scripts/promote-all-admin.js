"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const user_model_1 = require("../models/user.model");
dotenv_1.default.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
    const result = await user_model_1.User.updateMany({}, {
        $set: {
            role: 'admin',
            isActive: true,
            mustChangePassword: false
        }
    });
    console.log(`✅ Users updated: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    console.log('ℹ️  Все пользователи теперь admin (RBAC сохранен, но ограничений для текущих пользователей нет).');
    await mongoose_1.default.disconnect();
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});

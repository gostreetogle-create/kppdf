"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    roleId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Role', index: true },
    role: { type: String, default: undefined },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
}, { timestamps: true });
exports.User = (0, mongoose_1.model)('User', UserSchema);

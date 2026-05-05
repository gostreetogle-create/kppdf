"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
const mongoose_1 = require("mongoose");
const RoleSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    key: { type: String, required: true, trim: true, unique: true, lowercase: true, index: true },
    isSystem: { type: Boolean, default: false },
    permissions: { type: [String], default: [] }
}, { timestamps: true });
RoleSchema.index({ name: 1 }, { unique: true });
RoleSchema.index({ key: 1 }, { unique: true });
exports.Role = (0, mongoose_1.model)('Role', RoleSchema);

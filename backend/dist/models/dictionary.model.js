"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dictionary = void 0;
const mongoose_1 = require("mongoose");
const DictionarySchema = new mongoose_1.Schema({
    type: { type: String, enum: ['category', 'subcategory', 'unit', 'kind'], required: true },
    value: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
DictionarySchema.index({ type: 1, value: 1 }, { unique: true });
exports.Dictionary = (0, mongoose_1.model)('Dictionary', DictionarySchema);

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
const ProductImageSchema = new mongoose_1.Schema({
    url: { type: String, required: true },
    isMain: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    context: { type: String, enum: ['product', 'kp-page1', 'kp-page2', 'passport'], default: 'product' },
}, { _id: false });
const ProductSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: '', trim: true },
    subcategory: { type: String, trim: true },
    unit: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    costRub: { type: Number, min: 0 },
    images: { type: [ProductImageSchema], default: [] },
    isActive: { type: Boolean, default: true },
    kind: { type: String, enum: ['ITEM', 'SERVICE', 'WORK'], default: 'ITEM' },
    notes: { type: String },
}, { timestamps: true });
ProductSchema.index({ name: 'text', code: 'text', description: 'text' });
ProductSchema.index({ category: 1, isActive: 1 });
exports.Product = (0, mongoose_1.model)('Product', ProductSchema);

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSpec = void 0;
const mongoose_1 = require("mongoose");
const ProductSpecParamSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
}, { _id: false });
const ProductSpecGroupSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    params: { type: [ProductSpecParamSchema], default: [] }
}, { _id: false });
const ProductSpecDrawingsSchema = new mongoose_1.Schema({
    viewFront: { type: String, trim: true },
    viewSide: { type: String, trim: true },
    viewTop: { type: String, trim: true },
    view3D: { type: String, trim: true }
}, { _id: false });
const ProductSpecSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true, index: true },
    drawings: { type: ProductSpecDrawingsSchema, default: {} },
    groups: { type: [ProductSpecGroupSchema], default: [] }
}, { timestamps: true });
exports.ProductSpec = (0, mongoose_1.model)('ProductSpec', ProductSpecSchema);

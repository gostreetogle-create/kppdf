"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kp = void 0;
const mongoose_1 = require("mongoose");
const KpItemSchema = new mongoose_1.Schema({
    productId: { type: String, required: true },
    code: { type: String },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    unit: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, default: 1, min: [1, 'qty должен быть >= 1'] },
    imageUrl: { type: String, default: '' },
}, { _id: false });
const KpSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
    counterpartyId: { type: String },
    companyId: { type: String },
    recipient: {
        name: { type: String, default: '' },
        shortName: String,
        legalForm: String,
        inn: String,
        kpp: String,
        ogrn: String,
        legalAddress: String,
        phone: String,
        email: String,
        bankName: String,
        bik: String,
        checkingAccount: String,
        correspondentAccount: String,
        founderName: String,
        founderNameShort: String,
    },
    metadata: {
        number: { type: String, required: true },
        validityDays: { type: Number, default: 10 },
        prepaymentPercent: { type: Number, default: 50 },
        productionDays: { type: Number, default: 15 },
        tablePageBreakAfter: { type: Number, default: 10, min: [1, 'tablePageBreakAfter должен быть >= 1'] },
    },
    items: { type: [KpItemSchema], default: [] },
    conditions: { type: [String], default: [] },
    vatPercent: { type: Number, default: 20 },
}, { timestamps: true });
exports.Kp = (0, mongoose_1.model)('Kp', KpSchema);

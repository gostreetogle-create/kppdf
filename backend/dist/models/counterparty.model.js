"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Counterparty = void 0;
const mongoose_1 = require("mongoose");
const ContactSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    position: String,
    phone: String,
    email: String,
}, { _id: false });
const ImageSchema = new mongoose_1.Schema({
    url: { type: String, required: true },
    isMain: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    context: { type: String, enum: ['product', 'kp-page1', 'kp-page2', 'passport'], required: true },
}, { _id: false });
const CounterpartySchema = new mongoose_1.Schema({
    legalForm: {
        type: String,
        enum: ['ООО', 'ИП', 'АО', 'ПАО', 'Физлицо', 'Другое'],
        required: true
    },
    role: { type: [String], enum: ['client', 'supplier', 'company'], default: ['client'] },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    inn: { type: String, required: true, trim: true, match: [/^\d{10}(\d{2})?$/, 'ИНН должен содержать 10 или 12 цифр'] },
    kpp: { type: String, trim: true, match: [/^\d{9}$/, 'КПП должен содержать 9 цифр'] },
    ogrn: { type: String, trim: true },
    legalAddress: String,
    actualAddress: String,
    sameAddress: { type: Boolean, default: false },
    phone: String,
    email: String,
    website: String,
    contacts: { type: [ContactSchema], default: [] },
    bankName: String,
    bik: String,
    checkingAccount: String,
    correspondentAccount: String,
    founderName: String,
    founderNameShort: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: String,
    tags: { type: [String], default: [] },
    // Company profile
    isOurCompany: { type: Boolean, default: false },
    images: { type: [ImageSchema], default: [] },
    footerText: { type: String, default: '' },
}, { timestamps: true });
CounterpartySchema.index({ inn: 1 });
CounterpartySchema.index({ name: 'text', shortName: 'text' });
CounterpartySchema.index({ isOurCompany: 1 });
exports.Counterparty = (0, mongoose_1.model)('Counterparty', CounterpartySchema);

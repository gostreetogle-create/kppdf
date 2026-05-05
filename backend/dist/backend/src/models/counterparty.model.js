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
const BrandingTemplateSchema = new mongoose_1.Schema({
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    kpType: { type: String, enum: ['standard', 'response', 'special', 'tender', 'service'], required: true },
    isDefault: { type: Boolean, default: false },
    assets: {
        kpPage1: { type: String, required: true, trim: true },
        kpPage2: { type: String, trim: true },
        passport: { type: String, trim: true },
        appendix: { type: String, trim: true },
    },
    conditions: { type: [String], default: [] }
}, { _id: false });
const CounterpartySchema = new mongoose_1.Schema({
    legalForm: {
        type: String,
        enum: { values: ['ООО', 'ИП', 'АО', 'ПАО', 'МКУ', 'Физлицо', 'Другое'], message: 'Некорректная организационно-правовая форма' },
        required: [true, 'Орг. форма обязательна']
    },
    role: { type: [String], enum: { values: ['client', 'supplier', 'company'], message: 'Некорректная роль контрагента' }, default: ['client'] },
    name: { type: String, required: [true, 'Полное название обязательно'], trim: true },
    shortName: { type: String, required: [true, 'Краткое название обязательно'], trim: true },
    inn: {
        type: String,
        trim: true,
        required: [
            function () { return this.legalForm !== 'Физлицо'; },
            'ИНН обязателен'
        ],
        validate: {
            validator(value) {
                const inn = (value ?? '').trim();
                if (!inn)
                    return this.legalForm === 'Физлицо';
                return /^\d{10}(\d{2})?$/.test(inn);
            },
            message: 'ИНН должен содержать 10 или 12 цифр'
        }
    },
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
    status: { type: String, enum: { values: ['active', 'inactive'], message: 'Некорректный статус контрагента' }, required: [true, 'Статус обязателен'], default: 'active' },
    notes: String,
    tags: { type: [String], default: [] },
    // Company profile
    isOurCompany: { type: Boolean, default: false },
    isDefaultInitiator: { type: Boolean, default: false },
    images: { type: [ImageSchema], default: [] },
    footerText: { type: String, default: '' },
    defaultMarkupPercent: { type: Number, default: 0, min: [0, 'defaultMarkupPercent должен быть >= 0'], max: [500, 'defaultMarkupPercent должен быть <= 500'] },
    defaultDiscountPercent: { type: Number, default: 0, min: [0, 'defaultDiscountPercent должен быть >= 0'], max: [100, 'defaultDiscountPercent должен быть <= 100'] },
    brandingTemplates: { type: [BrandingTemplateSchema], default: [] },
}, { timestamps: true });
CounterpartySchema.pre('validate', function (next) {
    const templates = Array.isArray(this.brandingTemplates) ? this.brandingTemplates : [];
    const keys = new Set();
    for (const template of templates) {
        const key = String(template?.key ?? '').trim();
        if (!key)
            return next(new Error('У шаблона брендирования обязателен ключ'));
        if (keys.has(key))
            return next(new Error(`Ключ шаблона "${key}" должен быть уникальным в рамках компании`));
        keys.add(key);
        const kpPage1 = String(template?.assets?.kpPage1 ?? '').trim();
        if (!kpPage1) {
            return next(new Error(`Шаблон "${template?.name || key}" должен содержать фон первой страницы (assets.kpPage1)`));
        }
    }
    const kpTypes = ['standard', 'response', 'special', 'tender', 'service'];
    for (const kpType of kpTypes) {
        const defaults = templates.filter((template) => template?.kpType === kpType && template?.isDefault === true);
        if (defaults.length > 1) {
            return next(new Error(`Для типа КП "${kpType}" может быть только один шаблон по умолчанию`));
        }
    }
    return next();
});
CounterpartySchema.index({ inn: 1 });
CounterpartySchema.index({ name: 'text', shortName: 'text' });
CounterpartySchema.index({ isOurCompany: 1 });
exports.Counterparty = (0, mongoose_1.model)('Counterparty', CounterpartySchema);

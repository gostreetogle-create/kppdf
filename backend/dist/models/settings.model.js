"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = exports.Setting = void 0;
const mongoose_1 = require("mongoose");
const SettingSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose_1.Schema.Types.Mixed, required: true },
    label: { type: String, required: true },
}, { timestamps: true });
exports.Setting = (0, mongoose_1.model)('Setting', SettingSchema);
// Дефолтные настройки системы
exports.DEFAULT_SETTINGS = [
    { key: 'kp_validity_days', value: 10, label: 'Срок действия КП (раб. дней)' },
    { key: 'kp_prepayment_percent', value: 80, label: 'Предоплата (%)' },
    { key: 'kp_production_days', value: 25, label: 'Срок изготовления (раб. дней)' },
    { key: 'kp_vat_percent', value: 22, label: 'НДС (%)' },
];

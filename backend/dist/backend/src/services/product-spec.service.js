"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productSpecService = exports.ProductSpecService = void 0;
const product_model_1 = require("../models/product.model");
const product_spec_model_1 = require("../models/product-spec.model");
const settings_model_1 = require("../models/settings.model");
const PRODUCT_SPEC_TEMPLATES_KEY = 'product_spec_templates_v1';
const FALLBACK_TEMPLATES = [
    {
        key: 'sport-stand',
        name: 'Спортивный стенд',
        groups: [
            {
                title: 'Габариты',
                params: [
                    { name: 'Длина', value: '2000 мм' },
                    { name: 'Ширина', value: '800 мм' },
                    { name: 'Высота', value: '2400 мм' }
                ]
            },
            {
                title: 'Материалы',
                params: [
                    { name: 'Каркас', value: 'Сталь порошковая окраска' },
                    { name: 'Панели', value: 'Фанера влагостойкая' }
                ]
            }
        ]
    },
    {
        key: 'maf',
        name: 'Малая архитектурная форма',
        groups: [
            {
                title: 'Основание',
                params: [
                    { name: 'Тип основания', value: 'Закладные детали' },
                    { name: 'Тип монтажа', value: 'Анкерное крепление' }
                ]
            },
            {
                title: 'Эксплуатация',
                params: [
                    { name: 'Температура', value: 'от -40 до +40 C' },
                    { name: 'Гарантия', value: '12 месяцев' }
                ]
            }
        ]
    },
    {
        key: 'pavilion',
        name: 'Павильон',
        groups: [
            {
                title: 'Конструкция',
                params: [
                    { name: 'Несущий профиль', value: 'Труба 80x80 мм' },
                    { name: 'Заполнение', value: 'Монолитный поликарбонат' }
                ]
            },
            {
                title: 'Кровля и водоотвод',
                params: [
                    { name: 'Тип кровли', value: 'Односкатная' },
                    { name: 'Водоотвод', value: 'Скрытый' }
                ]
            }
        ]
    }
];
function normalizeTemplates(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => {
        const key = String(item?.key ?? '').trim();
        const name = String(item?.name ?? '').trim();
        const groupsRaw = Array.isArray(item?.groups) ? item.groups : [];
        const groups = groupsRaw
            .map((group) => ({
            title: String(group?.title ?? '').trim(),
            params: (Array.isArray(group?.params) ? group.params : [])
                .map((param) => ({
                name: String(param?.name ?? '').trim(),
                value: String(param?.value ?? '').trim()
            }))
                .filter((param) => param.name && param.value)
        }))
            .filter((group) => group.title && group.params.length > 0);
        if (!key || !name || !groups.length)
            return null;
        return { key, name, groups };
    })
        .filter((item) => !!item);
}
function normalizePayload(payload) {
    const drawings = payload.drawings ?? {};
    const groupsRaw = Array.isArray(payload.groups) ? payload.groups : [];
    return {
        drawings: {
            viewFront: String(drawings.viewFront ?? '').trim() || undefined,
            viewSide: String(drawings.viewSide ?? '').trim() || undefined,
            viewTop: String(drawings.viewTop ?? '').trim() || undefined,
            view3D: String(drawings.view3D ?? '').trim() || undefined
        },
        groups: groupsRaw
            .map((group) => ({
            title: String(group?.title ?? '').trim(),
            params: (Array.isArray(group?.params) ? group.params : [])
                .map((param) => ({
                name: String(param?.name ?? '').trim(),
                value: String(param?.value ?? '').trim()
            }))
                .filter((param) => param.name && param.value)
        }))
            .filter((group) => group.title && group.params.length > 0)
    };
}
class ProductSpecService {
    async list() {
        return product_spec_model_1.ProductSpec.find().sort({ updatedAt: -1 }).lean();
    }
    async getById(id) {
        return product_spec_model_1.ProductSpec.findById(id).lean();
    }
    async getSpecByProductId(productId) {
        return product_spec_model_1.ProductSpec.findOne({ productId }).lean();
    }
    async getTemplates() {
        const setting = await settings_model_1.Setting.findOne({ key: PRODUCT_SPEC_TEMPLATES_KEY }).lean();
        const fromSettings = normalizeTemplates(setting?.value);
        if (fromSettings.length)
            return fromSettings;
        return FALLBACK_TEMPLATES;
    }
    async create(payload) {
        const productId = String(payload.productId ?? '').trim();
        if (!productId)
            throw new Error('productId обязателен');
        const productExists = await product_model_1.Product.exists({ _id: productId });
        if (!productExists)
            throw new Error('Товар не найден');
        const normalized = normalizePayload(payload);
        return product_spec_model_1.ProductSpec.create({
            productId,
            drawings: normalized.drawings,
            groups: normalized.groups
        });
    }
    async update(id, payload) {
        const normalized = normalizePayload(payload);
        return product_spec_model_1.ProductSpec.findByIdAndUpdate(id, { $set: normalized }, { new: true, runValidators: true }).lean();
    }
    async upsertSpec(productId, payload) {
        const normalizedProductId = String(productId ?? '').trim();
        if (!normalizedProductId)
            throw new Error('productId обязателен');
        const productExists = await product_model_1.Product.exists({ _id: normalizedProductId });
        if (!productExists)
            throw new Error('Товар не найден');
        const normalized = normalizePayload(payload);
        return product_spec_model_1.ProductSpec.findOneAndUpdate({ productId: normalizedProductId }, {
            $set: {
                productId: normalizedProductId,
                drawings: normalized.drawings,
                groups: normalized.groups
            }
        }, { new: true, upsert: true, runValidators: true }).lean();
    }
    // Backward-compatible aliases for existing callers.
    async getSpecsByProductId(productId) {
        return this.getSpecByProductId(productId);
    }
    async upsertSpecs(productId, payload) {
        return this.upsertSpec(productId, payload);
    }
    async remove(id) {
        return product_spec_model_1.ProductSpec.findByIdAndDelete(id).lean();
    }
}
exports.ProductSpecService = ProductSpecService;
exports.productSpecService = new ProductSpecService();

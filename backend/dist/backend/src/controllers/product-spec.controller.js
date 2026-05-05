"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductSpecByProductId = getProductSpecByProductId;
exports.upsertProductSpecByProductId = upsertProductSpecByProductId;
exports.getProductSpecTemplates = getProductSpecTemplates;
exports.uploadProductSpecDrawing = uploadProductSpecDrawing;
const product_spec_service_1 = require("../services/product-spec.service");
function resolveErrorStatus(message) {
    return /найден|обязателен/i.test(message) ? 400 : 500;
}
async function getProductSpecByProductId(req, res) {
    try {
        const spec = await product_spec_service_1.productSpecService.getSpecByProductId(req.params.productId);
        if (!spec) {
            res.status(200).json(null);
            return;
        }
        res.json(spec);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID товара' });
    }
}
async function upsertProductSpecByProductId(req, res) {
    try {
        const updated = await product_spec_service_1.productSpecService.upsertSpec(req.params.productId, req.body);
        res.json(updated);
    }
    catch (error) {
        const message = error?.message || 'Ошибка сохранения профиля';
        res.status(resolveErrorStatus(String(message))).json({ message });
    }
}
async function getProductSpecTemplates(_req, res) {
    try {
        const templates = await product_spec_service_1.productSpecService.getTemplates();
        res.json(templates);
    }
    catch {
        res.status(500).json({ message: 'Не удалось получить шаблоны техпаспорта' });
    }
}
function uploadProductSpecDrawing(req, res) {
    const file = req.file;
    if (!file?.filename) {
        res.status(400).json({ message: 'Файл не передан' });
        return;
    }
    res.json({ url: `/media/specs/${file.filename}` });
}

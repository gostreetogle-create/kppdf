"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_model_1 = require("../models/product.model");
const dictionary_model_1 = require("../models/dictionary.model");
const router = (0, express_1.Router)();
function validateProduct(req, res, next) {
    const { name, code, unit, price } = req.body;
    const errors = [];
    if (!name?.trim())
        errors.push('name обязателен');
    if (!code?.trim())
        errors.push('code (артикул) обязателен');
    if (!unit?.trim())
        errors.push('unit обязателен');
    if (price == null || isNaN(Number(price)) || Number(price) < 0)
        errors.push('price должен быть числом >= 0');
    if (errors.length) {
        res.status(400).json({ errors });
        return;
    }
    next();
}
// GET /api/products?category=&kind=&isActive=true&q=
router.get('/', async (req, res) => {
    try {
        const { category, kind, isActive, q } = req.query;
        const filter = {};
        if (category)
            filter.category = category;
        if (kind)
            filter.kind = kind;
        if (isActive !== undefined)
            filter.isActive = isActive === 'true';
        if (q)
            filter.$text = { $search: String(q) };
        const products = await product_model_1.Product.find(filter).sort({ category: 1, name: 1 });
        res.json(products);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// GET /api/products/categories — уникальные категории из товаров + из справочника
router.get('/categories', async (_req, res) => {
    try {
        const [fromProducts, fromDict] = await Promise.all([
            product_model_1.Product.distinct('category', { category: { $ne: '' } }),
            dictionary_model_1.Dictionary.find({ type: 'category', isActive: true }).sort({ sortOrder: 1, value: 1 })
        ]);
        // Объединяем: справочник + уникальные из товаров которых нет в справочнике
        const dictValues = fromDict.map(d => d.value);
        const extra = fromProducts.filter(c => !dictValues.includes(c));
        res.json([...dictValues, ...extra]);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const product = await product_model_1.Product.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Товар не найден' });
            return;
        }
        res.json(product);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
// POST /api/products/bulk — массовый импорт
// Body: { items: Array<product fields>, mode: 'skip' | 'update' }
// mode='skip'   — пропустить товар если артикул уже существует (default)
// mode='update' — обновить существующий товар по артикулу
router.post('/bulk', async (req, res) => {
    const { items, mode = 'skip' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'items должен быть непустым массивом' });
        return;
    }
    if (!['skip', 'update'].includes(mode)) {
        res.status(400).json({ message: 'mode должен быть "skip" или "update"' });
        return;
    }
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const item of items) {
        // Нормализуем поля: поддерживаем как unitCode/priceRub (формат bulk-json), так и unit/price
        const payload = buildPayload({
            ...item,
            unit: item.unit ?? item.unitCode,
            price: item.price ?? item.priceRub,
        });
        if (!payload.code || !payload.name || !payload.unit || payload.price == null) {
            results.errors.push(`Пропущен товар без обязательных полей: ${JSON.stringify({ code: item.code, name: item.name })}`);
            continue;
        }
        try {
            const existing = await product_model_1.Product.findOne({ code: payload.code });
            if (existing) {
                if (mode === 'update') {
                    await product_model_1.Product.findByIdAndUpdate(existing._id, payload, { runValidators: true });
                    results.updated++;
                }
                else {
                    results.skipped++;
                }
            }
            else {
                await product_model_1.Product.create(payload);
                results.created++;
            }
        }
        catch (e) {
            results.errors.push(`Ошибка для артикула "${payload.code}": ${e.message}`);
        }
    }
    res.status(200).json(results);
});
// POST /api/products
router.post('/', validateProduct, async (req, res) => {
    try {
        const product = await product_model_1.Product.create(buildPayload(req.body));
        res.status(201).json(product);
    }
    catch (e) {
        if (e.code === 11000) {
            res.status(400).json({ errors: [`Артикул "${req.body.code}" уже существует`] });
        }
        else {
            res.status(500).json({ message: 'Ошибка при создании' });
        }
    }
});
// PUT /api/products/:id
router.put('/:id', validateProduct, async (req, res) => {
    try {
        const product = await product_model_1.Product.findByIdAndUpdate(req.params.id, buildPayload(req.body), { new: true, runValidators: true });
        if (!product) {
            res.status(404).json({ message: 'Товар не найден' });
            return;
        }
        res.json(product);
    }
    catch (e) {
        if (e.code === 11000) {
            res.status(400).json({ errors: [`Артикул "${req.body.code}" уже существует`] });
        }
        else {
            res.status(400).json({ message: 'Неверный ID или данные' });
        }
    }
});
// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
    try {
        const product = await product_model_1.Product.findByIdAndDelete(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Товар не найден' });
            return;
        }
        res.status(204).send();
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
function buildPayload(body) {
    return {
        code: body.code?.trim(),
        name: body.name?.trim(),
        description: body.description?.trim() ?? '',
        category: body.category?.trim() ?? '',
        subcategory: body.subcategory?.trim(),
        unit: body.unit?.trim(),
        price: Number(body.price),
        costRub: body.costRub != null ? Number(body.costRub) : undefined,
        images: Array.isArray(body.images) ? body.images : [],
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        kind: body.kind ?? 'ITEM',
        notes: body.notes?.trim(),
    };
}
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_model_1 = require("../models/product.model");
const product_spec_model_1 = require("../models/product-spec.model");
const dictionary_model_1 = require("../models/dictionary.model");
const rbac_guard_1 = require("../middleware/rbac.guard");
const product_dto_1 = require("../dtos/product.dto");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const image_trim_util_1 = require("../utils/image-trim.util");
const router = (0, express_1.Router)();
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
const productsMediaDir = path_1.default.join(mediaRoot, 'products');
if (!fs_1.default.existsSync(productsMediaDir))
    fs_1.default.mkdirSync(productsMediaDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, productsMediaDir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
            const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
            cb(null, `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
        }
    }),
    fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp)$/i.test(file.mimetype);
        if (!ok) {
            cb(new Error('Допустимы только PNG/JPG/WEBP изображения'));
            return;
        }
        cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 }
});
router.use((req, res, next) => {
    const isRead = req.method === 'GET';
    return (0, rbac_guard_1.requirePermission)(isRead ? 'products.view' : 'products.write')(req, res, next);
});
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
        const { category, kind, isActive, q, hasSpec, page, limit, includeSpecId } = req.query;
        const filter = {};
        if (category)
            filter.category = category;
        if (kind)
            filter.kind = kind;
        if (isActive !== undefined)
            filter.isActive = isActive === 'true';
        if (q)
            filter.$text = { $search: String(q) };
        const pageNum = Math.max(1, Number.parseInt(String(page ?? ''), 10) || 1);
        const limitNumRaw = Number.parseInt(String(limit ?? ''), 10);
        const limitNum = Math.min(200, Math.max(1, Number.isFinite(limitNumRaw) ? limitNumRaw : 50));
        const isPaged = page !== undefined || limit !== undefined;
        const shouldIncludeSpecId = includeSpecId !== 'false';
        const needsSpecJoin = hasSpec === 'true' || hasSpec === 'false' || shouldIncludeSpecId;
        const sort = q
            ? { score: -1, name: 1 }
            : { category: 1, name: 1 };
        const pipeline = [{ $match: filter }];
        if (q)
            pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
        if (needsSpecJoin) {
            pipeline.push({
                $lookup: {
                    from: 'productspecs',
                    let: { pid: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$productId', '$$pid'] } } },
                        { $project: { _id: 1 } },
                        { $limit: 1 }
                    ],
                    as: 'spec'
                }
            });
            pipeline.push({
                $addFields: {
                    specId: {
                        $cond: [
                            { $gt: [{ $size: '$spec' }, 0] },
                            { $toString: { $arrayElemAt: ['$spec._id', 0] } },
                            '$$REMOVE'
                        ]
                    }
                }
            });
            pipeline.push({ $project: { spec: 0 } });
        }
        if (hasSpec === 'true')
            pipeline.push({ $match: { specId: { $exists: true } } });
        if (hasSpec === 'false')
            pipeline.push({ $match: { specId: { $exists: false } } });
        if (!shouldIncludeSpecId)
            pipeline.push({ $unset: ['specId'] });
        if (isPaged) {
            const skip = (pageNum - 1) * limitNum;
            const [result] = await product_model_1.Product.aggregate([
                ...pipeline,
                {
                    $facet: {
                        items: [{ $sort: sort }, { $skip: skip }, { $limit: limitNum }],
                        total: [{ $count: 'count' }]
                    }
                }
            ]);
            const items = (result?.items ?? []).map(product_dto_1.mapProductToDto);
            const total = result?.total?.[0]?.count ?? 0;
            res.json({ items, page: pageNum, limit: limitNum, total });
            return;
        }
        const products = await product_model_1.Product.aggregate([...pipeline, { $sort: sort }]);
        res.json(products.map(product_dto_1.mapProductToDto));
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
// POST /api/products/upload-image
router.post('/upload-image', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
            return;
        }
        const file = req.file;
        if (!file?.filename) {
            res.status(400).json({ message: 'Файл не передан' });
            return;
        }
        try {
            await (0, image_trim_util_1.trimProductImagePadding)(file.path);
        }
        catch (trimError) {
            console.warn('[products/upload-image] trim skipped:', trimError);
        }
        res.json({ url: `/media/products/${file.filename}` });
    });
});
// POST /api/products/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
    try {
        const original = await product_model_1.Product.findById(req.params.id);
        if (!original) {
            res.status(404).json({ message: 'Оригинальный товар не найден' });
            return;
        }
        const { _id, createdAt, updatedAt, __v, ...originalObj } = original.toObject();
        // Генерируем новый артикул, чтобы избежать коллизии unique index
        let newCode = `${originalObj.code}-copy`;
        let suffix = 1;
        while (await product_model_1.Product.exists({ code: newCode })) {
            newCode = `${originalObj.code}-copy-${suffix++}`;
        }
        const duplicatedProduct = await product_model_1.Product.create({
            ...originalObj,
            code: newCode,
            name: `${originalObj.name} (копия)`,
            isActive: false // По умолчанию копия неактивна, чтобы не мусорить в каталоге
        });
        // Дублируем тех. паспорт если он есть
        const originalSpec = await product_spec_model_1.ProductSpec.findOne({ productId: original._id });
        let newSpecId;
        if (originalSpec) {
            const { _id: _, createdAt: __, updatedAt: ___, __v: ____, ...specObj } = originalSpec.toObject();
            const newSpec = await product_spec_model_1.ProductSpec.create({
                ...specObj,
                productId: duplicatedProduct._id
            });
            newSpecId = String(newSpec._id);
        }
        res.status(201).json((0, product_dto_1.mapProductToDto)({
            ...duplicatedProduct.toObject(),
            specId: newSpecId
        }));
    }
    catch (e) {
        console.error('[products/duplicate] error:', e);
        res.status(500).json({ message: 'Ошибка при дублировании товара' });
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
        const spec = await product_spec_model_1.ProductSpec.findOne({ productId: product._id }).select('_id').lean();
        res.json((0, product_dto_1.mapProductToDto)({
            ...product.toObject(),
            specId: spec?._id ? String(spec._id) : undefined
        }));
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
        res.status(201).json((0, product_dto_1.mapProductToDto)(product));
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
        res.json((0, product_dto_1.mapProductToDto)(product));
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

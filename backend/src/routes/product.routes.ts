import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model';
import { ProductSpec } from '../models/product-spec.model';
import { Dictionary } from '../models/dictionary.model';
import { requirePermission } from '../middleware/rbac.guard';
import { mapProductToDto } from '../dtos/product.dto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { trimProductImagePadding } from '../utils/image-trim.util';

const router = Router();
const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
const productsMediaDir = path.join(mediaRoot, 'products');
if (!fs.existsSync(productsMediaDir)) fs.mkdirSync(productsMediaDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productsMediaDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
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
  return requirePermission(isRead ? 'products.view' : 'products.write')(req, res, next);
});

function validateProduct(req: Request, res: Response, next: NextFunction): void {
  const { name, code, unit, price } = req.body;
  const errors: string[] = [];
  if (!name?.trim())  errors.push('name обязателен');
  if (!code?.trim())  errors.push('code (артикул) обязателен');
  if (!unit?.trim())  errors.push('unit обязателен');
  if (price == null || isNaN(Number(price)) || Number(price) < 0)
    errors.push('price должен быть числом >= 0');
  if (errors.length) { res.status(400).json({ errors }); return; }
  next();
}

// GET /api/products?category=&kind=&isActive=true&q=
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, kind, isActive, q, hasSpec } = req.query;
    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (kind)     filter.kind     = kind;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (q)        filter.$text    = { $search: String(q) };
    const products = await Product.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'productspecs',
          localField: '_id',
          foreignField: 'productId',
          as: 'spec'
        }
      },
      {
        $addFields: {
          specId: {
            $cond: [
              { $gt: [{ $size: '$spec' }, 0] },
              { $toString: { $arrayElemAt: ['$spec._id', 0] } },
              undefined
            ]
          }
        }
      },
      ...(hasSpec === 'true' ? [{ $match: { specId: { $exists: true } } }] : []),
      ...(hasSpec === 'false' ? [{ $match: { specId: { $exists: false } } }] : []),
      { $project: { spec: 0 } },
      { $sort: { category: 1, name: 1 } }
    ]);
    res.json(products.map(mapProductToDto));
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/products/categories — уникальные категории из товаров + из справочника
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const [fromProducts, fromDict] = await Promise.all([
      Product.distinct('category', { category: { $ne: '' } }),
      Dictionary.find({ type: 'category', isActive: true }).sort({ sortOrder: 1, value: 1 })
    ]);
    // Объединяем: справочник + уникальные из товаров которых нет в справочнике
    const dictValues = fromDict.map(d => d.value);
    const extra = (fromProducts as string[]).filter(c => !dictValues.includes(c));
    res.json([...dictValues, ...extra]);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/products/upload-image
router.post('/upload-image', (req: Request, res: Response) => {
  upload.single('file')(req as any, res as any, async (err: any) => {
    if (err) {
      res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
      return;
    }
    const file = (req as any).file;
    if (!file?.filename) {
      res.status(400).json({ message: 'Файл не передан' });
      return;
    }
    try {
      await trimProductImagePadding(file.path);
    } catch (trimError) {
      console.warn('[products/upload-image] trim skipped:', trimError);
    }
    res.json({ url: `/media/products/${file.filename}` });
  });
});

// POST /api/products/:id/duplicate
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const original = await Product.findById(req.params.id);
    if (!original) {
      res.status(404).json({ message: 'Оригинальный товар не найден' });
      return;
    }

    const { _id, createdAt, updatedAt, __v, ...originalObj } = original.toObject() as any;

    // Генерируем новый артикул, чтобы избежать коллизии unique index
    let newCode = `${originalObj.code}-copy`;
    let suffix = 1;
    while (await Product.exists({ code: newCode })) {
      newCode = `${originalObj.code}-copy-${suffix++}`;
    }

    const duplicatedProduct = await Product.create({
      ...originalObj,
      code: newCode,
      name: `${originalObj.name} (копия)`,
      isActive: false // По умолчанию копия неактивна, чтобы не мусорить в каталоге
    });

    // Дублируем тех. паспорт если он есть
    const originalSpec = await ProductSpec.findOne({ productId: original._id });
    let newSpecId: string | undefined;

    if (originalSpec) {
      const { _id: _, createdAt: __, updatedAt: ___, __v: ____, ...specObj } = originalSpec.toObject() as any;

      const newSpec = await ProductSpec.create({
        ...specObj,
        productId: duplicatedProduct._id
      });
      newSpecId = String(newSpec._id);
    }

    res.status(201).json(mapProductToDto({
      ...duplicatedProduct.toObject(),
      specId: newSpecId
    }));
  } catch (e: any) {
    console.error('[products/duplicate] error:', e);
    res.status(500).json({ message: 'Ошибка при дублировании товара' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ message: 'Товар не найден' }); return; }
    const spec = await ProductSpec.findOne({ productId: product._id }).select('_id').lean();
    res.json(mapProductToDto({
      ...product.toObject(),
      specId: spec?._id ? String(spec._id) : undefined
    }));
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

// POST /api/products/bulk — массовый импорт
// Body: { items: Array<product fields>, mode: 'skip' | 'update' }
// mode='skip'   — пропустить товар если артикул уже существует (default)
// mode='update' — обновить существующий товар по артикулу
router.post('/bulk', async (req: Request, res: Response) => {
  const { items, mode = 'skip' } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ message: 'items должен быть непустым массивом' });
    return;
  }
  if (!['skip', 'update'].includes(mode)) {
    res.status(400).json({ message: 'mode должен быть "skip" или "update"' });
    return;
  }

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const item of items) {
    // Нормализуем поля: поддерживаем как unitCode/priceRub (формат bulk-json), так и unit/price
    const payload = buildPayload({
      ...item,
      unit:  item.unit  ?? item.unitCode,
      price: item.price ?? item.priceRub,
    });

    if (!payload.code || !payload.name || !payload.unit || payload.price == null) {
      results.errors.push(`Пропущен товар без обязательных полей: ${JSON.stringify({ code: item.code, name: item.name })}`);
      continue;
    }

    try {
      const existing = await Product.findOne({ code: payload.code });
      if (existing) {
        if (mode === 'update') {
          await Product.findByIdAndUpdate(existing._id, payload, { runValidators: true });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await Product.create(payload);
        results.created++;
      }
    } catch (e: any) {
      results.errors.push(`Ошибка для артикула "${payload.code}": ${e.message}`);
    }
  }

  res.status(200).json(results);
});

// POST /api/products
router.post('/', validateProduct, async (req: Request, res: Response) => {
  try {
    const product = await Product.create(buildPayload(req.body));
    res.status(201).json(mapProductToDto(product));
  } catch (e: any) {
    if (e.code === 11000) {
      res.status(400).json({ errors: [`Артикул "${req.body.code}" уже существует`] });
    } else {
      res.status(500).json({ message: 'Ошибка при создании' });
    }
  }
});

// PUT /api/products/:id
router.put('/:id', validateProduct, async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id, buildPayload(req.body), { new: true, runValidators: true }
    );
    if (!product) { res.status(404).json({ message: 'Товар не найден' }); return; }
    res.json(mapProductToDto(product));
  } catch (e: any) {
    if (e.code === 11000) {
      res.status(400).json({ errors: [`Артикул "${req.body.code}" уже существует`] });
    } else {
      res.status(400).json({ message: 'Неверный ID или данные' });
    }
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) { res.status(404).json({ message: 'Товар не найден' }); return; }
    res.status(204).send();
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

function buildPayload(body: any) {
  return {
    code:        body.code?.trim(),
    name:        body.name?.trim(),
    description: body.description?.trim() ?? '',
    category:    body.category?.trim() ?? '',
    subcategory: body.subcategory?.trim(),
    unit:        body.unit?.trim(),
    price:       Number(body.price),
    costRub:     body.costRub != null ? Number(body.costRub) : undefined,
    images:      Array.isArray(body.images) ? body.images : [],
    isActive:    body.isActive !== undefined ? Boolean(body.isActive) : true,
    kind:        body.kind ?? 'ITEM',
    notes:       body.notes?.trim(),
  };
}

export default router;

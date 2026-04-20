import { Router, Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model';
import { Dictionary } from '../models/dictionary.model';

const router = Router();

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
    const { category, kind, isActive, q } = req.query;
    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (kind)     filter.kind     = kind;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (q)        filter.$text    = { $search: String(q) };
    const products = await Product.find(filter).sort({ category: 1, name: 1 });
    res.json(products);
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

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) { res.status(404).json({ message: 'Товар не найден' }); return; }
    res.json(product);
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

// POST /api/products
router.post('/', validateProduct, async (req: Request, res: Response) => {
  try {
    const product = await Product.create(buildPayload(req.body));
    res.status(201).json(product);
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
    res.json(product);
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

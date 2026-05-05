import { Router, Request, Response } from 'express';
import { DictionaryType } from '../../../shared/types/ApiResponses';
import { Dictionary } from '../models/dictionary.model';
import { requirePermission } from '../middleware/rbac.guard';

const router = Router();

router.use(requirePermission('settings.write'));

// GET /api/dictionaries?type=category
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const filter: Record<string, any> = { isActive: true };
    if (type) filter.type = type;
    const list = await Dictionary.find(filter).sort({ sortOrder: 1, value: 1 });
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/dictionaries
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await Dictionary.create(req.body);
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

// PUT /api/dictionaries/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const item = await Dictionary.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) { res.status(404).json({ message: 'Не найдено' }); return; }
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE /api/dictionaries/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Dictionary.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

export default router;

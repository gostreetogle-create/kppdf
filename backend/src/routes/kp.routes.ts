import { Router, Request, Response } from 'express';
import { Kp } from '../models/kp.model';

const router = Router();

// GET /api/kp
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await Kp.find().sort({ createdAt: -1 });
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/kp
router.post('/', async (req: Request, res: Response) => {
  try {
    const kp = await Kp.create(req.body);
    res.status(201).json(kp);
  } catch (e: any) {
    console.error('❌ POST /kp error:', e.message);
    res.status(400).json({ message: e.message });
  }
});

// POST /api/kp/:id/duplicate
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const original = await Kp.findById(req.params.id);
    if (!original) { res.status(404).json({ message: 'Not found' }); return; }

    // Используем timestamp вместо countDocuments — нет race condition
    const number = `КП-${Date.now()}`;

    const duplicate = await Kp.create({
      title:      `Копия — ${original.title}`,
      status:     'draft',
      recipient:  original.recipient,
      metadata:   { ...original.metadata, number },
      items:      original.items,
      conditions: original.conditions,
      vatPercent: original.vatPercent,
    });

    res.status(201).json(duplicate);
  } catch (e: any) {
    console.error('❌ POST /kp/:id/duplicate error:', e.message);
    res.status(400).json({ message: e.message });
  }
});

// GET /api/kp/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const kp = await Kp.findById(req.params.id);
    if (!kp) { res.status(404).json({ message: 'Not found' }); return; }
    res.json(kp);
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

// PUT /api/kp/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const kp = await Kp.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!kp) { res.status(404).json({ message: 'Not found' }); return; }
    res.json(kp);
  } catch {
    res.status(400).json({ message: 'Неверный ID или данные' });
  }
});

// DELETE /api/kp/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await Kp.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

export default router;

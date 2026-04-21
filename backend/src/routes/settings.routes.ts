import { Router, Request, Response } from 'express';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';

const router = Router();

// Инициализация дефолтных настроек (если не существуют)
async function ensureDefaults() {
  for (const s of DEFAULT_SETTINGS) {
    await Setting.findOneAndUpdate(
      { key: s.key },
      { $setOnInsert: s },
      { upsert: true, new: true }
    );
  }
}

// GET /api/settings — все настройки
router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureDefaults();
    const settings = await Setting.find().sort({ key: 1 });
    // Возвращаем как объект { key: value } для удобства фронта
    const map: Record<string, unknown> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ list: settings, map });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/settings/:key — обновить одну настройку
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value },
      { new: true }
    );
    if (!setting) { res.status(404).json({ message: 'Настройка не найдена' }); return; }
    res.json(setting);
  } catch {
    res.status(400).json({ message: 'Ошибка обновления' });
  }
});

// PUT /api/settings — обновить несколько настроек сразу
router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, unknown>;
    const ops = Object.entries(updates).map(([key, value]) =>
      Setting.findOneAndUpdate({ key }, { value }, { new: true })
    );
    await Promise.all(ops);
    const settings = await Setting.find().sort({ key: 1 });
    const map: Record<string, unknown> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ list: settings, map });
  } catch {
    res.status(400).json({ message: 'Ошибка обновления' });
  }
});

export default router;

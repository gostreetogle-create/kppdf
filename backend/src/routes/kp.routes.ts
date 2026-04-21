import { Router, Request, Response } from 'express';
import { Kp } from '../models/kp.model';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import { Counterparty } from '../models/counterparty.model';

const router = Router();

// Получить настройки КП (с фолбэком на дефолты)
async function getKpSettings() {
  const settings = await Setting.find({ key: { $in: DEFAULT_SETTINGS.map(s => s.key) } });
  const map: Record<string, unknown> = {};
  DEFAULT_SETTINGS.forEach(s => { map[s.key] = s.value; }); // дефолты
  settings.forEach(s => { map[s.key] = s.value; });          // из БД
  return map;
}

// GET /api/kp
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await Kp.find().sort({ createdAt: -1 });
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/kp — создать черновик с дефолтами из Settings
router.post('/', async (req: Request, res: Response) => {
  try {
    // Если дефолты не переданы — берём из Settings
    let body = { ...req.body };
    if (!body.metadata?.validityDays) {
      const s = await getKpSettings();
      body.metadata = {
        number:            body.metadata?.number ?? `КП-${Date.now()}`,
        validityDays:      s['kp_validity_days'],
        prepaymentPercent: s['kp_prepayment_percent'],
        productionDays:    s['kp_production_days'],
      };
      body.vatPercent = body.vatPercent ?? s['kp_vat_percent'];
    }

    // Автоматически привязываем нашу компанию
    if (!body.companyId) {
      const company = await Counterparty.findOne({ isOurCompany: true, status: 'active' });
      if (company) body.companyId = company._id.toString();
    }

    const kp = await Kp.create(body);
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

    const duplicate = await Kp.create({
      title:      `Копия — ${original.title}`,
      status:     'draft',
      companyId:  original.companyId,
      recipient:  original.recipient,
      metadata:   { ...original.metadata, number: `КП-${Date.now()}` },
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

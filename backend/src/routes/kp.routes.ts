import { Router, Request, Response } from 'express';
import { Kp } from '../models/kp.model';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import { Counterparty } from '../models/counterparty.model';
import { requirePermission } from '../middleware/rbac.guard';

const router = Router();

router.use((req, res, next) => {
  if (req.method === 'GET') return requirePermission('kp.view')(req, res, next);
  if (req.method === 'POST') return requirePermission('kp.create')(req, res, next);
  if (req.method === 'PUT' || req.method === 'PATCH') return requirePermission('kp.edit')(req, res, next);
  if (req.method === 'DELETE') return requirePermission('kp.delete')(req, res, next);
  return next();
});

async function generateKpNumber() {
  const all = await Kp.find(
    { 'metadata.number': { $regex: /^КП-\d+$/ } },
    { 'metadata.number': 1 }
  ).lean();
  const maxSerial = all.reduce((max, doc) => {
    const value = typeof doc?.metadata?.number === 'string' ? doc.metadata.number : '';
    const match = /^КП-(\d+)$/.exec(value);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `КП-${String(maxSerial + 1).padStart(3, '0')}`;
}

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
    const companyId = String(body.companyId ?? '').trim();
    if (!companyId) {
      res.status(400).json({ message: 'companyId обязателен при создании КП' });
      return;
    }
    if (!body.metadata?.validityDays) {
      const generatedNumber = await generateKpNumber();
      const s = await getKpSettings();
      body.metadata = {
        number:            body.metadata?.number ?? generatedNumber,
        validityDays:      s['kp_validity_days'],
        prepaymentPercent: s['kp_prepayment_percent'],
        productionDays:    s['kp_production_days'],
        tablePageBreakAfter: body.metadata?.tablePageBreakAfter ?? 6,
        photoScalePercent: body.metadata?.photoScalePercent ?? 150,
      };
      body.vatPercent = body.vatPercent ?? s['kp_vat_percent'];
    }
    if (!body.metadata?.number) {
      body.metadata = { ...body.metadata, number: await generateKpNumber() };
    }
    body.metadata = {
      ...body.metadata,
      photoScalePercent: body.metadata?.photoScalePercent ?? 150
    };

    const company = await Counterparty.findById(companyId)
      .select('isOurCompany name shortName images footerText status')
      .lean();
    if (!company || company.isOurCompany !== true) {
      res.status(400).json({ message: 'Компания-инициатор не найдена или не является нашей компанией' });
      return;
    }
    body.companyId = companyId;
    body.companySnapshot = {
      name: String(company.shortName || company.name || '').trim(),
      images: (Array.isArray(company.images) ? company.images : [])
        .filter((img: any) => ['kp-page1', 'kp-page2', 'passport'].includes(img?.context))
        .map((img: any) => ({ url: String(img.url || '').trim(), context: img.context }))
        .filter((img: any) => Boolean(img.url)),
      footerText: String(company.footerText || '')
    };
    if (!body.companySnapshot.name) {
      res.status(400).json({ message: 'У выбранной компании не заполнено название для брендирования КП' });
      return;
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
    const generatedNumber = await generateKpNumber();

    const duplicate = await Kp.create({
      title:      `Копия — ${original.title}`,
      status:     'draft',
      companyId:  original.companyId,
      companySnapshot: original.companySnapshot,
      recipient:  original.recipient,
      metadata:   { ...original.metadata, number: generatedNumber },
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
    const existing = await Kp.findById(req.params.id);
    if (!existing) { res.status(404).json({ message: 'Not found' }); return; }

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

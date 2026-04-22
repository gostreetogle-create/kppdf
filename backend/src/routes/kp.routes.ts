import { Router, Request, Response } from 'express';
import { Kp } from '../models/kp.model';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import { Counterparty } from '../models/counterparty.model';
import { requirePermission } from '../middleware/rbac.guard';

const router = Router();
const KP_TYPE_VALUES = ['standard', 'response', 'special', 'tender', 'service'] as const;
type KpType = (typeof KP_TYPE_VALUES)[number];

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
    const kpType = String(body.kpType ?? '').trim() as KpType;
    const templateKey = String(body.templateKey ?? '').trim();
    if (!companyId) {
      res.status(400).json({ message: 'companyId обязателен при создании КП' });
      return;
    }
    if (!KP_TYPE_VALUES.includes(kpType)) {
      res.status(400).json({ message: 'kpType обязателен и должен быть одним из: standard, response, special, tender, service' });
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
      .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates')
      .lean();
    const isCompanyInitiator = Boolean(
      company &&
      (company.isOurCompany === true || (Array.isArray((company as any).role) && (company as any).role.includes('company')))
    );
    if (!company || !isCompanyInitiator) {
      res.status(400).json({ message: 'Компания-инициатор не найдена или не является нашей компанией' });
      return;
    }

    const templates = Array.isArray((company as any).brandingTemplates) ? (company as any).brandingTemplates : [];
    let selectedTemplate = null as any;

    if (templateKey) {
      selectedTemplate = templates.find((template: any) =>
        String(template?.key ?? '') === templateKey && String(template?.kpType ?? '') === kpType
      );
      if (!selectedTemplate) {
        res.status(400).json({ message: 'Выбранный шаблон не найден для указанного типа КП' });
        return;
      }
    } else {
      selectedTemplate = templates.find((template: any) =>
        String(template?.kpType ?? '') === kpType && template?.isDefault === true
      );
      if (!selectedTemplate) {
        res.status(400).json({
          message: `Для типа КП "${kpType}" не задан шаблон по умолчанию. Настройте шаблоны в карточке компании.`
        });
        return;
      }
    }

    const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      res.status(400).json({ message: 'Выбранный шаблон не содержит обязательный фон первой страницы (assets.kpPage1)' });
      return;
    }

    body.companyId = companyId;
    body.kpType = kpType;
    body.companySnapshot = {
      companyId: company._id,
      companyName: String(company.shortName || company.name || '').trim(),
      templateKey: String(selectedTemplate.key),
      templateName: String(selectedTemplate.name),
      kpType,
      assets: {
        kpPage1,
        kpPage2: String(selectedTemplate?.assets?.kpPage2 ?? '').trim() || undefined,
        passport: String(selectedTemplate?.assets?.passport ?? '').trim() || undefined,
        appendix: String(selectedTemplate?.assets?.appendix ?? '').trim() || undefined,
      },
      texts: {
        headerNote: '',
        introText: '',
        footerText: '',
        closingText: '',
      },
      requisitesSnapshot: {
        inn: String(company.inn ?? '').trim() || undefined,
        kpp: String(company.kpp ?? '').trim() || undefined,
        ogrn: String(company.ogrn ?? '').trim() || undefined,
        phone: String(company.phone ?? '').trim() || undefined,
        email: String(company.email ?? '').trim() || undefined,
      }
    };
    if (!body.companySnapshot.companyName) {
      res.status(400).json({ message: 'У выбранной компании не заполнено название для брендирования КП' });
      return;
    }
    const hasRequestConditions = Array.isArray(body.conditions) && body.conditions.length > 0;
    if (!hasRequestConditions) {
      body.conditions = Array.isArray(selectedTemplate?.conditions)
        ? selectedTemplate.conditions
            .map((value: unknown) => String(value ?? '').trim())
            .filter(Boolean)
        : [];
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
      kpType:     (original as any).kpType ?? original.companySnapshot?.kpType ?? 'standard',
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

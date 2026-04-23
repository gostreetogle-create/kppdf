import { Router, Request, Response } from 'express';
import { Kp } from '../models/kp.model';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import { Counterparty } from '../models/counterparty.model';
import { requirePermission } from '../middleware/rbac.guard';

const router = Router();
const KP_TYPE_VALUES = ['standard', 'response', 'special', 'tender', 'service'] as const;
type KpType = (typeof KP_TYPE_VALUES)[number];
const KP_TYPE_NUMBER_PREFIX: Record<KpType, string> = {
  standard: 'КП',
  response: 'ПИСЬМО',
  special: 'КП',
  tender: 'КП',
  service: 'КП'
};

router.use((req, res, next) => {
  if (req.method === 'GET') return requirePermission('kp.view')(req, res, next);
  if (req.method === 'POST') return requirePermission('kp.create')(req, res, next);
  if (req.method === 'PUT' || req.method === 'PATCH') return requirePermission('kp.edit')(req, res, next);
  if (req.method === 'DELETE') return requirePermission('kp.delete')(req, res, next);
  return next();
});

function numberPrefixForType(kpType: KpType): string {
  return KP_TYPE_NUMBER_PREFIX[kpType] ?? 'КП';
}

function isAutoNumberForType(value: string, kpType: KpType): boolean {
  const prefix = numberPrefixForType(kpType);
  return new RegExp(`^${prefix}-\\d+$`).test(value);
}

async function generateDocNumber(kpType: KpType) {
  const prefix = numberPrefixForType(kpType);
  const regex = new RegExp(`^${prefix}-\\d+$`);
  const all = await Kp.find(
    { 'metadata.number': { $regex: regex } },
    { 'metadata.number': 1 }
  ).lean();
  const maxSerial = all.reduce((max, doc) => {
    const value = typeof doc?.metadata?.number === 'string' ? doc.metadata.number : '';
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return `${prefix}-${String(maxSerial + 1).padStart(3, '0')}`;
}

function normalizeTemplateConditions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value ?? '').trim()).filter(Boolean);
}

function normalizeTemplateAssetsByType(kpType: KpType, assets: any) {
  const normalized = {
    kpPage1: String(assets?.kpPage1 ?? '').trim(),
    kpPage2: String(assets?.kpPage2 ?? '').trim() || undefined,
    passport: String(assets?.passport ?? '').trim() || undefined,
    appendix: String(assets?.appendix ?? '').trim() || undefined,
  };
  if (kpType === 'response') {
    return { kpPage1: normalized.kpPage1 };
  }
  return normalized;
}

function normalizeSnapshotTexts(texts: any) {
  return {
    headerNote: String(texts?.headerNote ?? '').trim(),
    introText: String(texts?.introText ?? '').trim(),
    footerText: String(texts?.footerText ?? '').trim(),
    closingText: String(texts?.closingText ?? '').trim(),
  };
}

function isCompanyInitiator(company: any): boolean {
  return Boolean(
    company &&
    (
      company.isOurCompany === true
      || (Array.isArray(company.role) && company.role.includes('company'))
    )
  );
}

async function resolveCompanyInitiator(preferredCompanyId?: string) {
  if (preferredCompanyId) {
    const company = await Counterparty.findById(preferredCompanyId)
      .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
      .lean();
    if (isCompanyInitiator(company)) return company;
    return null;
  }
  const all = await Counterparty.find({
    status: 'active',
    $or: [{ isOurCompany: true }, { role: 'company' }]
  })
    .select('isOurCompany role name shortName status inn kpp ogrn phone email brandingTemplates defaultMarkupPercent defaultDiscountPercent isDefaultInitiator')
    .lean();
  if (!all.length) return null;
  return all.find((item: any) => item.isDefaultInitiator === true) ?? all[0];
}

function resolveTemplateForType(templates: any[], kpType: KpType, templateKey?: string): any | null {
  if (templateKey) {
    return templates.find((template: any) =>
      String(template?.key ?? '') === templateKey && String(template?.kpType ?? '') === kpType
    ) ?? null;
  }
  const templatesByType = templates.filter((template: any) => String(template?.kpType ?? '') === kpType);
  return templatesByType.find((template: any) => template?.isDefault === true)
    ?? templatesByType[0]
    ?? null;
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
    const companyId = String(body.companyId ?? '').trim() || undefined;
    const kpType = (String(body.kpType ?? '').trim() as KpType) || 'standard';
    const templateKey = String(body.templateKey ?? '').trim();
    if (!KP_TYPE_VALUES.includes(kpType)) {
      res.status(400).json({ message: 'kpType обязателен и должен быть одним из: standard, response, special, tender, service' });
      return;
    }
    if (!body.metadata?.validityDays) {
      const generatedNumber = await generateDocNumber(kpType);
      const s = await getKpSettings();
      body.metadata = {
        number:            body.metadata?.number ?? generatedNumber,
        validityDays:      s['kp_validity_days'],
        prepaymentPercent: s['kp_prepayment_percent'],
        productionDays:    s['kp_production_days'],
        tablePageBreakAfter: body.metadata?.tablePageBreakAfter ?? 6,
        photoScalePercent: body.metadata?.photoScalePercent ?? 150,
        defaultMarkupPercent: body.metadata?.defaultMarkupPercent ?? 0,
        defaultDiscountPercent: body.metadata?.defaultDiscountPercent ?? 0,
      };
      body.vatPercent = body.vatPercent ?? s['kp_vat_percent'];
    }
    if (!body.metadata?.number) {
      body.metadata = { ...body.metadata, number: await generateDocNumber(kpType) };
    }
    body.metadata = {
      ...body.metadata,
      photoScalePercent: body.metadata?.photoScalePercent ?? 150,
      defaultMarkupPercent: Number(body.metadata?.defaultMarkupPercent ?? 0) || 0,
      defaultDiscountPercent: Number(body.metadata?.defaultDiscountPercent ?? 0) || 0,
    };

    const company = await resolveCompanyInitiator(companyId);
    if (!company) {
      res.status(400).json({ message: 'Компания-инициатор не найдена или не является нашей компанией' });
      return;
    }

    const templates = Array.isArray((company as any).brandingTemplates) ? (company as any).brandingTemplates : [];
    let selectedTemplate = null as any;

    selectedTemplate = resolveTemplateForType(templates, kpType, templateKey);
    if (!selectedTemplate) {
      res.status(400).json({
        message: templateKey
          ? 'Выбранный шаблон не найден для указанного типа КП'
          : `Для типа КП "${kpType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`
      });
      return;
    }

    const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      res.status(400).json({ message: 'Выбранный шаблон не содержит обязательный фон первой страницы (assets.kpPage1)' });
      return;
    }

    const templateAssets = normalizeTemplateAssetsByType(kpType, selectedTemplate?.assets);
    body.companyId = String((company as any)._id);
    body.kpType = kpType;
    body.companySnapshot = {
      companyId: (company as any)._id,
      companyName: String(company.shortName || company.name || '').trim(),
      templateKey: String(selectedTemplate.key),
      templateName: String(selectedTemplate.name),
      kpType,
      assets: templateAssets,
      texts: {
        headerNote: '',
        introText: '',
        footerText: '',
        closingText: '',
      },
      requisitesSnapshot: {
        inn: String((company as any).inn ?? '').trim() || undefined,
        kpp: String((company as any).kpp ?? '').trim() || undefined,
        ogrn: String((company as any).ogrn ?? '').trim() || undefined,
        phone: String((company as any).phone ?? '').trim() || undefined,
        email: String((company as any).email ?? '').trim() || undefined,
      }
    };
    if (!body.companySnapshot.companyName) {
      res.status(400).json({ message: 'У выбранной компании не заполнено название для брендирования КП' });
      return;
    }
    const hasRequestConditions = Array.isArray(body.conditions) && body.conditions.length > 0;
    if (!hasRequestConditions) {
      body.conditions = normalizeTemplateConditions(selectedTemplate?.conditions);
    }
    body.metadata.defaultMarkupPercent = Number((company as any).defaultMarkupPercent ?? body.metadata.defaultMarkupPercent ?? 0) || 0;
    body.metadata.defaultDiscountPercent = Number((company as any).defaultDiscountPercent ?? body.metadata.defaultDiscountPercent ?? 0) || 0;

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
    const sourceType = ((original as any).kpType ?? original.companySnapshot?.kpType ?? 'standard') as KpType;
    const generatedNumber = await generateDocNumber(sourceType);

    const duplicate = await Kp.create({
      title:      `Копия — ${original.title}`,
      status:     'draft',
      companyId:  original.companyId,
      kpType:     sourceType,
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

// PUT /api/kp/:id/switch-type
router.put('/:id/switch-type', async (req: Request, res: Response) => {
  try {
    const kp = await Kp.findById(req.params.id);
    if (!kp) { res.status(404).json({ message: 'Not found' }); return; }

    const nextType = String(req.body?.kpType ?? '').trim() as KpType;
    if (!KP_TYPE_VALUES.includes(nextType)) {
      res.status(400).json({ message: 'Некорректный kpType' });
      return;
    }
    const templateKey = String(req.body?.templateKey ?? '').trim() || undefined;

    const resolvedCompanyId =
      String(req.body?.companyId ?? '').trim()
      || String((kp.companyId as any) ?? '').trim()
      || String((kp.companySnapshot as any)?.companyId ?? '').trim();
    if (!resolvedCompanyId) {
      res.status(400).json({ message: 'В КП не указан companyId (ни в корне, ни в companySnapshot)' });
      return;
    }

    const company = await resolveCompanyInitiator(resolvedCompanyId);
    if (!company || !isCompanyInitiator(company)) {
      res.status(400).json({ message: 'Компания-инициатор не найдена или не является нашей компанией' });
      return;
    }

    const templates = Array.isArray((company as any).brandingTemplates) ? (company as any).brandingTemplates : [];
    const selectedTemplate = resolveTemplateForType(templates, nextType, templateKey);
    if (!selectedTemplate) {
      res.status(400).json({
        message: templateKey
          ? 'Выбранный шаблон не найден для указанного типа КП'
          : `Для типа КП "${nextType}" не найдено ни одного шаблона. Настройте шаблоны в карточке компании.`
      });
      return;
    }

    const kpPage1 = String(selectedTemplate?.assets?.kpPage1 ?? '').trim();
    if (!kpPage1) {
      res.status(400).json({ message: `Шаблон "${selectedTemplate?.name || selectedTemplate?.key}" не содержит assets.kpPage1` });
      return;
    }

    const prevType = ((kp as any).kpType ?? kp.companySnapshot?.kpType ?? 'standard') as KpType;
    const currentNumber = String(kp.metadata?.number ?? '').trim();
    const nextNumber = isAutoNumberForType(currentNumber, prevType)
      ? await generateDocNumber(nextType)
      : currentNumber;

    const previousTemplate = resolveTemplateForType(
      templates,
      prevType,
      String(kp.companySnapshot?.templateKey ?? '').trim() || undefined
    );
    const currentConditions = normalizeTemplateConditions(kp.conditions);
    const previousTemplateConditions = normalizeTemplateConditions(previousTemplate?.conditions);
    const nextTemplateConditions = normalizeTemplateConditions(selectedTemplate?.conditions);
    const shouldReplaceConditions = req.body?.overwriteConditions === true
      || (currentConditions.length === previousTemplateConditions.length
          && currentConditions.every((value, index) => value === previousTemplateConditions[index]));
    const nextConditions = shouldReplaceConditions ? nextTemplateConditions : kp.conditions;

    const nextMetadata = {
      ...kp.metadata,
      number: nextNumber,
      defaultMarkupPercent: Number((company as any).defaultMarkupPercent ?? kp.metadata?.defaultMarkupPercent ?? 0) || 0,
      defaultDiscountPercent: Number((company as any).defaultDiscountPercent ?? kp.metadata?.defaultDiscountPercent ?? 0) || 0,
    };

    kp.companyId = String((company as any)._id);
    kp.kpType = nextType;
    kp.metadata = nextMetadata as any;
    kp.conditions = nextConditions;
    kp.companySnapshot = {
      ...kp.companySnapshot,
      companyId: company._id as any,
      companyName: String((company as any).shortName || (company as any).name || kp.companySnapshot.companyName || ''),
      templateKey: String(selectedTemplate.key),
      templateName: String(selectedTemplate.name),
      kpType: nextType,
      assets: normalizeTemplateAssetsByType(nextType, selectedTemplate.assets) as any,
      texts: normalizeSnapshotTexts((kp.companySnapshot as any)?.texts),
      requisitesSnapshot: {
        inn: String((company as any).inn ?? '').trim() || undefined,
        kpp: String((company as any).kpp ?? '').trim() || undefined,
        ogrn: String((company as any).ogrn ?? '').trim() || undefined,
        phone: String((company as any).phone ?? '').trim() || undefined,
        email: String((company as any).email ?? '').trim() || undefined,
      }
    } as any;

    await kp.save();
    res.json({
      kp,
      meta: {
        conditionsReplaced: shouldReplaceConditions,
        previousKpType: prevType,
        nextKpType: nextType
      }
    });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Не удалось переключить тип КП' });
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

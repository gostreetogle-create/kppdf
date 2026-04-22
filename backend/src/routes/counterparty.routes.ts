import { Router, Request, Response } from 'express';
import { Counterparty } from '../models/counterparty.model';
import { requirePermission } from '../middleware/rbac.guard';
import { CounterpartyController } from '../controllers/counterparty.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const counterpartyController = new CounterpartyController();
const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
const kpMediaDir = path.join(mediaRoot, 'kp');
if (!fs.existsSync(kpMediaDir)) fs.mkdirSync(kpMediaDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, kpMediaDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
      cb(null, `kp-brand-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
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

router.use(requirePermission('counterparties.crud'));

// GET /api/counterparties/company — наша компания (isOurCompany=true)
router.get('/company', async (_req: Request, res: Response) => {
  try {
    const company = await Counterparty.findOne({ isOurCompany: true, status: 'active' })
      .sort({ isDefaultInitiator: -1, name: 1 });
    if (!company) { res.status(404).json({ message: 'Компания не настроена' }); return; }
    res.json(company);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/counterparties?role=client&status=active&q=поиск
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role, status, q, isOurCompany } = req.query;
    const filter: Record<string, any> = {};
    if (role)   filter.role   = role;
    if (status) filter.status = status;
    if (typeof isOurCompany === 'string') {
      if (isOurCompany === 'true') {
        // Backward compatibility: historical records might have role=company but isOurCompany=false.
        filter.$or = [{ isOurCompany: true }, { role: 'company' }];
      }
      if (isOurCompany === 'false') filter.isOurCompany = false;
    }
    if (q)      filter.$text  = { $search: String(q) };
    const list = await Counterparty.find(filter).sort({ name: 1 });
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/counterparties/lookup?inn=1234567890
// Поиск по ИНН через DaData — возвращает данные для автозаполнения
router.get('/lookup', async (req: Request, res: Response) => {
  const { inn } = req.query;
  if (!inn) { res.status(400).json({ message: 'Укажите inn' }); return; }

  const token = process.env.DADATA_TOKEN;
  if (!token) { res.status(503).json({ message: 'DADATA_TOKEN не настроен' }); return; }

  try {
    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Token ${token}`,
      },
      body: JSON.stringify({ query: String(inn), count: 1 }),
    });

    if (!response.ok) {
      res.status(502).json({ message: 'Ошибка DaData API' });
      return;
    }

    const data = await response.json() as { suggestions: any[] };
    if (!data.suggestions?.length) {
      res.status(404).json({ message: 'Компания не найдена' });
      return;
    }

    const s = data.suggestions[0];
    const d = s.data;

    // Маппим ответ DaData → наш формат Counterparty
    const result = {
      legalForm:    d.opf?.short ?? 'Другое',
      name:         d.name?.full_with_opf ?? s.value,
      shortName:    d.name?.short ?? d.name?.short_with_opf ?? s.value,
      inn:          d.inn,
      kpp:          d.kpp ?? undefined,
      ogrn:         d.ogrn ?? undefined,
      legalAddress: d.address?.value ?? undefined,
      status:       d.state?.status === 'ACTIVE' ? 'active' : 'inactive',
      // ИП — добавляем ФИО
      founderName:      d.type === 'INDIVIDUAL' ? d.name?.full : undefined,
      founderNameShort: d.type === 'INDIVIDUAL' ? buildShortName(d.name?.full) : undefined,
    };

    res.json(result);
  } catch (e: any) {
    console.error('DaData lookup error:', e.message);
    res.status(502).json({ message: 'Ошибка при запросе к DaData' });
  }
});

// POST /api/counterparties/upload-branding-image
router.post('/upload-branding-image', (req: Request, res: Response) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) {
      res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
      return;
    }
    const file = (req as any).file;
    if (!file?.filename) {
      res.status(400).json({ message: 'Файл не передан' });
      return;
    }
    res.json({ url: `/media/kp/${file.filename}` });
  });
});

// GET /api/counterparties/:id/branding-templates
router.get('/:id/branding-templates', counterpartyController.getBrandingTemplates);

// POST /api/counterparties/bulk — массовый импорт
// Body: { items: Array<counterparty fields>, mode: 'skip' | 'update' }
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
    const payload = buildPayload(item);
    if (!payload.name || !payload.inn || !payload.legalForm || !payload.status || payload.role.length === 0) {
      results.errors.push(`Пропущен контрагент без обязательных полей: ${JSON.stringify({ name: item.name, inn: item.inn })}`);
      continue;
    }

    try {
      const existing = await Counterparty.findOne({ inn: payload.inn });
      if (existing) {
        if (mode === 'update') {
          await Counterparty.findByIdAndUpdate(existing._id, payload, { runValidators: true });
          results.updated++;
        } else {
          results.skipped++;
        }
      } else {
        await Counterparty.create(payload);
        results.created++;
      }
    } catch (e: any) {
      results.errors.push(`Ошибка для ИНН "${payload.inn}": ${formatCounterpartyError(e)}`);
    }
  }

  res.status(200).json(results);
});

// GET /api/counterparties/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cp = await Counterparty.findById(req.params.id);
    if (!cp) { res.status(404).json({ message: 'Контрагент не найден' }); return; }
    res.json(cp);
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

// POST /api/counterparties
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload = buildPayload(req.body);
    const cp = await Counterparty.create(payload);
    if (cp.isDefaultInitiator) {
      await Counterparty.updateMany(
        { _id: { $ne: cp._id }, isOurCompany: true, isDefaultInitiator: true },
        { $set: { isDefaultInitiator: false } }
      );
    }
    res.status(201).json(cp);
  } catch (e: any) {
    res.status(400).json({ message: formatCounterpartyError(e) });
  }
});

// PUT /api/counterparties/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const payload = buildPayload(req.body);
    const cp = await Counterparty.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!cp) { res.status(404).json({ message: 'Контрагент не найден' }); return; }
    if (cp.isDefaultInitiator) {
      await Counterparty.updateMany(
        { _id: { $ne: cp._id }, isOurCompany: true, isDefaultInitiator: true },
        { $set: { isDefaultInitiator: false } }
      );
    }
    res.json(cp);
  } catch (e: any) {
    res.status(400).json({ message: formatCounterpartyError(e) });
  }
});

// DELETE /api/counterparties/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const cp = await Counterparty.findByIdAndDelete(req.params.id);
    if (!cp) { res.status(404).json({ message: 'Контрагент не найден' }); return; }
    res.status(204).send();
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
});

// Формирует краткое ФИО: "Иванов Иван Иванович" → "И.И. Иванов"
function buildShortName(fullName?: string): string | undefined {
  if (!fullName) return undefined;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const [surname, name, patronymic] = parts;
  const initials = [name, patronymic]
    .filter(Boolean)
    .map(p => `${p[0]}.`)
    .join('');
  return `${initials} ${surname}`;
}

export default router;

function buildPayload(body: any) {
  const normalizedRoles = Array.isArray(body.role) ? body.role : [];
  return {
    legalForm:             body.legalForm,
    role:                  normalizedRoles,
    name:                  body.name?.trim(),
    shortName:             body.shortName?.trim() ?? body.name?.trim(),
    inn:                   body.inn?.trim(),
    kpp:                   body.kpp?.trim(),
    ogrn:                  body.ogrn?.trim(),
    legalAddress:          body.legalAddress?.trim(),
    actualAddress:         body.actualAddress?.trim(),
    sameAddress:           Boolean(body.sameAddress),
    phone:                 body.phone?.trim(),
    email:                 body.email?.trim(),
    website:               body.website?.trim(),
    contacts:              Array.isArray(body.contacts) ? body.contacts : [],
    bankName:              body.bankName?.trim(),
    bik:                   body.bik?.trim(),
    checkingAccount:       body.checkingAccount?.trim(),
    correspondentAccount:  body.correspondentAccount?.trim(),
    founderName:           body.founderName?.trim(),
    founderNameShort:      body.founderNameShort?.trim(),
    status:                body.status,
    notes:                 body.notes?.trim(),
    tags:                  Array.isArray(body.tags) ? body.tags.map((v: string) => v.trim()).filter(Boolean) : [],
    isOurCompany:          Boolean(body.isOurCompany),
    isDefaultInitiator:    Boolean(body.isOurCompany) && Boolean(body.isDefaultInitiator),
    images:                Array.isArray(body.images) ? body.images : [],
    footerText:            body.footerText ?? '',
    brandingTemplates:     Array.isArray(body.brandingTemplates) ? body.brandingTemplates : []
  };
}

function formatCounterpartyError(error: any): string {
  if (!error) return 'Ошибка валидации контрагента';
  if (error.name === 'ValidationError' && error.errors) {
    const messages = Object.values(error.errors)
      .map((e: any) => e?.message)
      .filter(Boolean) as string[];
    if (messages.length) return messages.join('. ');
    return 'Ошибка валидации контрагента';
  }
  if (error.code === 11000 && error.keyPattern?.inn) {
    return 'Контрагент с таким ИНН уже существует';
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Ошибка валидации контрагента';
}

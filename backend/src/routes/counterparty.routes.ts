import { Router, Request, Response } from 'express';
import { Counterparty } from '../models/counterparty.model';

const router = Router();

// GET /api/counterparties/company — наша компания (isOurCompany=true)
router.get('/company', async (_req: Request, res: Response) => {
  try {
    const company = await Counterparty.findOne({ isOurCompany: true, status: 'active' });
    if (!company) { res.status(404).json({ message: 'Компания не настроена' }); return; }
    res.json(company);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/counterparties?role=client&status=active&q=поиск
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role, status, q } = req.query;
    const filter: Record<string, any> = {};
    if (role)   filter.role   = role;
    if (status) filter.status = status;
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
    const cp = await Counterparty.create(req.body);
    res.status(201).json(cp);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

// PUT /api/counterparties/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const cp = await Counterparty.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cp) { res.status(404).json({ message: 'Контрагент не найден' }); return; }
    res.json(cp);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
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

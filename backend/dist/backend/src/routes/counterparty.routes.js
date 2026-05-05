"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const counterparty_model_1 = require("../models/counterparty.model");
const rbac_guard_1 = require("../middleware/rbac.guard");
const counterparty_controller_1 = require("../controllers/counterparty.controller");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const counterpartyController = new counterparty_controller_1.CounterpartyController();
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
const kpMediaDir = path_1.default.join(mediaRoot, 'kp');
if (!fs_1.default.existsSync(kpMediaDir))
    fs_1.default.mkdirSync(kpMediaDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, kpMediaDir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
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
router.use((0, rbac_guard_1.requirePermission)('counterparties.crud'));
// GET /api/counterparties/company — наша компания (isOurCompany=true)
router.get('/company', async (_req, res) => {
    try {
        const company = await counterparty_model_1.Counterparty.findOne({ isOurCompany: true, status: 'active' })
            .sort({ isDefaultInitiator: -1, name: 1 });
        if (!company) {
            res.status(404).json({ message: 'Компания не настроена' });
            return;
        }
        res.json(company);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// GET /api/counterparties?role=client&status=active&q=поиск
router.get('/', async (req, res) => {
    try {
        const { role, status, q, isOurCompany } = req.query;
        const filter = {};
        if (role)
            filter.role = role;
        if (status)
            filter.status = status;
        if (typeof isOurCompany === 'string') {
            if (isOurCompany === 'true') {
                // Backward compatibility: historical records might have role=company but isOurCompany=false.
                filter.$or = [{ isOurCompany: true }, { role: 'company' }];
            }
            if (isOurCompany === 'false')
                filter.isOurCompany = false;
        }
        if (q)
            filter.$text = { $search: String(q) };
        const list = await counterparty_model_1.Counterparty.find(filter).sort({ name: 1 });
        res.json(list);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// GET /api/counterparties/lookup?inn=1234567890
// Поиск по ИНН через DaData — возвращает данные для автозаполнения
router.get('/lookup', async (req, res) => {
    const { inn } = req.query;
    if (!inn) {
        res.status(400).json({ message: 'Укажите inn' });
        return;
    }
    const token = process.env.DADATA_TOKEN;
    if (!token) {
        res.status(503).json({ message: 'DADATA_TOKEN не настроен' });
        return;
    }
    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${token}`,
            },
            body: JSON.stringify({ query: String(inn), count: 1 }),
        });
        if (!response.ok) {
            res.status(502).json({ message: 'Ошибка DaData API' });
            return;
        }
        const data = await response.json();
        if (!data.suggestions?.length) {
            res.status(404).json({ message: 'Компания не найдена' });
            return;
        }
        const s = data.suggestions[0];
        const d = s.data;
        // Маппим ответ DaData → наш формат Counterparty
        const result = {
            legalForm: d.opf?.short ?? 'Другое',
            name: d.name?.full_with_opf ?? s.value,
            shortName: d.name?.short ?? d.name?.short_with_opf ?? s.value,
            inn: d.inn,
            kpp: d.kpp ?? undefined,
            ogrn: d.ogrn ?? undefined,
            legalAddress: d.address?.value ?? undefined,
            status: d.state?.status === 'ACTIVE' ? 'active' : 'inactive',
            // ИП — добавляем ФИО
            founderName: d.type === 'INDIVIDUAL' ? d.name?.full : undefined,
            founderNameShort: d.type === 'INDIVIDUAL' ? buildShortName(d.name?.full) : undefined,
        };
        res.json(result);
    }
    catch (e) {
        console.error('DaData lookup error:', e.message);
        res.status(502).json({ message: 'Ошибка при запросе к DaData' });
    }
});
// POST /api/counterparties/upload-branding-image
router.post('/upload-branding-image', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
            return;
        }
        const file = req.file;
        if (!file?.filename) {
            res.status(400).json({ message: 'Файл не передан' });
            return;
        }
        res.json({ url: `/media/kp/${file.filename}` });
    });
});
// GET /api/counterparties/:id/branding-templates
router.get('/:id/branding-templates', counterpartyController.getBrandingTemplates);
// PUT /api/counterparties/:id/branding-templates
router.put('/:id/branding-templates', async (req, res) => {
    try {
        const cp = await counterparty_model_1.Counterparty.findById(req.params.id);
        if (!cp) {
            res.status(404).json({ message: 'Контрагент не найден' });
            return;
        }
        const isOurCompany = cp.isOurCompany === true || (Array.isArray(cp.role) && cp.role.includes('company'));
        if (!isOurCompany) {
            res.status(400).json({ message: 'Выбранный контрагент не является нашей компанией' });
            return;
        }
        const brandingTemplates = normalizeBrandingTemplates(req.body?.brandingTemplates);
        cp.brandingTemplates = brandingTemplates;
        await cp.save();
        res.json({
            message: 'Шаблоны брендирования обновлены',
            brandingTemplates: cp.brandingTemplates
        });
    }
    catch (e) {
        res.status(400).json({ message: formatCounterpartyError(e) });
    }
});
// POST /api/counterparties/bulk — массовый импорт
// Body: { items: Array<counterparty fields>, mode: 'skip' | 'update' }
router.post('/bulk', async (req, res) => {
    const { items, mode = 'skip' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ message: 'items должен быть непустым массивом' });
        return;
    }
    if (!['skip', 'update'].includes(mode)) {
        res.status(400).json({ message: 'mode должен быть "skip" или "update"' });
        return;
    }
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const item of items) {
        const payload = buildPayload(item);
        if (!payload.name || !payload.inn || !payload.legalForm || !payload.status || payload.role.length === 0) {
            results.errors.push(`Пропущен контрагент без обязательных полей: ${JSON.stringify({ name: item.name, inn: item.inn })}`);
            continue;
        }
        try {
            const existing = await counterparty_model_1.Counterparty.findOne({ inn: payload.inn });
            if (existing) {
                if (mode === 'update') {
                    await counterparty_model_1.Counterparty.findByIdAndUpdate(existing._id, payload, { runValidators: true });
                    results.updated++;
                }
                else {
                    results.skipped++;
                }
            }
            else {
                await counterparty_model_1.Counterparty.create(payload);
                results.created++;
            }
        }
        catch (e) {
            results.errors.push(`Ошибка для ИНН "${payload.inn}": ${formatCounterpartyError(e)}`);
        }
    }
    res.status(200).json(results);
});
// GET /api/counterparties/:id
router.get('/:id', async (req, res) => {
    try {
        const cp = await counterparty_model_1.Counterparty.findById(req.params.id);
        if (!cp) {
            res.status(404).json({ message: 'Контрагент не найден' });
            return;
        }
        res.json(cp);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
// POST /api/counterparties
router.post('/', async (req, res) => {
    try {
        const payload = buildPayload(req.body);
        const cp = await counterparty_model_1.Counterparty.create(payload);
        if (cp.isDefaultInitiator) {
            await counterparty_model_1.Counterparty.updateMany({ _id: { $ne: cp._id }, isOurCompany: true, isDefaultInitiator: true }, { $set: { isDefaultInitiator: false } });
        }
        res.status(201).json(cp);
    }
    catch (e) {
        res.status(400).json({ message: formatCounterpartyError(e) });
    }
});
// PUT /api/counterparties/:id
router.put('/:id', async (req, res) => {
    try {
        const payload = buildPayload(req.body);
        const cp = await counterparty_model_1.Counterparty.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
        if (!cp) {
            res.status(404).json({ message: 'Контрагент не найден' });
            return;
        }
        if (cp.isDefaultInitiator) {
            await counterparty_model_1.Counterparty.updateMany({ _id: { $ne: cp._id }, isOurCompany: true, isDefaultInitiator: true }, { $set: { isDefaultInitiator: false } });
        }
        res.json(cp);
    }
    catch (e) {
        res.status(400).json({ message: formatCounterpartyError(e) });
    }
});
// DELETE /api/counterparties/:id
router.delete('/:id', async (req, res) => {
    try {
        const cp = await counterparty_model_1.Counterparty.findByIdAndDelete(req.params.id);
        if (!cp) {
            res.status(404).json({ message: 'Контрагент не найден' });
            return;
        }
        res.status(204).send();
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
// Формирует краткое ФИО: "Иванов Иван Иванович" → "И.И. Иванов"
function buildShortName(fullName) {
    if (!fullName)
        return undefined;
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2)
        return fullName;
    const [surname, name, patronymic] = parts;
    const initials = [name, patronymic]
        .filter(Boolean)
        .map(p => `${p[0]}.`)
        .join('');
    return `${initials} ${surname}`;
}
exports.default = router;
function buildPayload(body) {
    const normalizedRoles = Array.isArray(body.role) ? body.role : [];
    return {
        legalForm: body.legalForm,
        role: normalizedRoles,
        name: body.name?.trim(),
        shortName: body.shortName?.trim() ?? body.name?.trim(),
        inn: body.inn?.trim(),
        kpp: body.kpp?.trim(),
        ogrn: body.ogrn?.trim(),
        legalAddress: body.legalAddress?.trim(),
        actualAddress: body.actualAddress?.trim(),
        sameAddress: Boolean(body.sameAddress),
        phone: body.phone?.trim(),
        email: body.email?.trim(),
        website: body.website?.trim(),
        contacts: Array.isArray(body.contacts) ? body.contacts : [],
        bankName: body.bankName?.trim(),
        bik: body.bik?.trim(),
        checkingAccount: body.checkingAccount?.trim(),
        correspondentAccount: body.correspondentAccount?.trim(),
        founderName: body.founderName?.trim(),
        founderNameShort: body.founderNameShort?.trim(),
        status: body.status,
        notes: body.notes?.trim(),
        tags: Array.isArray(body.tags) ? body.tags.map((v) => v.trim()).filter(Boolean) : [],
        isOurCompany: Boolean(body.isOurCompany),
        isDefaultInitiator: Boolean(body.isOurCompany) && Boolean(body.isDefaultInitiator),
        defaultMarkupPercent: Math.max(0, Math.min(500, Number(body.defaultMarkupPercent ?? 0) || 0)),
        defaultDiscountPercent: Math.max(0, Math.min(100, Number(body.defaultDiscountPercent ?? 0) || 0)),
        images: Array.isArray(body.images) ? body.images : [],
        footerText: body.footerText ?? '',
        brandingTemplates: Array.isArray(body.brandingTemplates) ? body.brandingTemplates : []
    };
}
function formatCounterpartyError(error) {
    if (!error)
        return 'Ошибка валидации контрагента';
    if (error.name === 'ValidationError' && error.errors) {
        const messages = Object.values(error.errors)
            .map((e) => e?.message)
            .filter(Boolean);
        if (messages.length)
            return messages.join('. ');
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
function normalizeBrandingTemplates(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((item) => ({
        key: String(item?.key ?? '').trim(),
        name: String(item?.name ?? '').trim(),
        kpType: String(item?.kpType ?? '').trim(),
        isDefault: Boolean(item?.isDefault),
        assets: {
            kpPage1: String(item?.assets?.kpPage1 ?? '').trim(),
            kpPage2: String(item?.assets?.kpPage2 ?? '').trim() || undefined,
            passport: String(item?.assets?.passport ?? '').trim() || undefined,
            appendix: String(item?.assets?.appendix ?? '').trim() || undefined,
        },
        conditions: Array.isArray(item?.conditions)
            ? item.conditions.map((value) => String(value ?? '').trim()).filter(Boolean)
            : []
    }));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const kp_model_1 = require("../models/kp.model");
const settings_model_1 = require("../models/settings.model");
const counterparty_model_1 = require("../models/counterparty.model");
const router = (0, express_1.Router)();
async function generateKpNumber() {
    const all = await kp_model_1.Kp.find({ 'metadata.number': { $regex: /^КП-\d+$/ } }, { 'metadata.number': 1 }).lean();
    const maxSerial = all.reduce((max, doc) => {
        const value = typeof doc?.metadata?.number === 'string' ? doc.metadata.number : '';
        const match = /^КП-(\d+)$/.exec(value);
        if (!match)
            return max;
        return Math.max(max, Number(match[1]));
    }, 0);
    return `КП-${String(maxSerial + 1).padStart(3, '0')}`;
}
// Получить настройки КП (с фолбэком на дефолты)
async function getKpSettings() {
    const settings = await settings_model_1.Setting.find({ key: { $in: settings_model_1.DEFAULT_SETTINGS.map(s => s.key) } });
    const map = {};
    settings_model_1.DEFAULT_SETTINGS.forEach(s => { map[s.key] = s.value; }); // дефолты
    settings.forEach(s => { map[s.key] = s.value; }); // из БД
    return map;
}
// GET /api/kp
router.get('/', async (_req, res) => {
    try {
        const list = await kp_model_1.Kp.find().sort({ createdAt: -1 });
        res.json(list);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// POST /api/kp — создать черновик с дефолтами из Settings
router.post('/', async (req, res) => {
    try {
        // Если дефолты не переданы — берём из Settings
        let body = { ...req.body };
        if (!body.metadata?.validityDays) {
            const generatedNumber = await generateKpNumber();
            const s = await getKpSettings();
            body.metadata = {
                number: body.metadata?.number ?? generatedNumber,
                validityDays: s['kp_validity_days'],
                prepaymentPercent: s['kp_prepayment_percent'],
                productionDays: s['kp_production_days'],
                tablePageBreakAfter: body.metadata?.tablePageBreakAfter ?? 10,
            };
            body.vatPercent = body.vatPercent ?? s['kp_vat_percent'];
        }
        if (!body.metadata?.number) {
            body.metadata = { ...body.metadata, number: await generateKpNumber() };
        }
        // Автоматически привязываем нашу компанию
        if (!body.companyId) {
            const company = await counterparty_model_1.Counterparty.findOne({ isOurCompany: true, status: 'active' });
            if (company)
                body.companyId = company._id.toString();
        }
        const kp = await kp_model_1.Kp.create(body);
        res.status(201).json(kp);
    }
    catch (e) {
        console.error('❌ POST /kp error:', e.message);
        res.status(400).json({ message: e.message });
    }
});
// POST /api/kp/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
    try {
        const original = await kp_model_1.Kp.findById(req.params.id);
        if (!original) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        const generatedNumber = await generateKpNumber();
        const duplicate = await kp_model_1.Kp.create({
            title: `Копия — ${original.title}`,
            status: 'draft',
            companyId: original.companyId,
            recipient: original.recipient,
            metadata: { ...original.metadata, number: generatedNumber },
            items: original.items,
            conditions: original.conditions,
            vatPercent: original.vatPercent,
        });
        res.status(201).json(duplicate);
    }
    catch (e) {
        console.error('❌ POST /kp/:id/duplicate error:', e.message);
        res.status(400).json({ message: e.message });
    }
});
// GET /api/kp/:id
router.get('/:id', async (req, res) => {
    try {
        const kp = await kp_model_1.Kp.findById(req.params.id);
        if (!kp) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json(kp);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
// PUT /api/kp/:id
router.put('/:id', async (req, res) => {
    try {
        const existing = await kp_model_1.Kp.findById(req.params.id);
        if (!existing) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        const nextStatus = req.body?.status;
        if (nextStatus && nextStatus !== existing.status) {
            const role = req.user?.role;
            if (role === 'manager') {
                const isAllowedForManager = existing.status === 'draft' && nextStatus === 'sent';
                if (!isAllowedForManager) {
                    res.status(403).json({ message: 'Менеджер может менять статус только draft → sent' });
                    return;
                }
            }
        }
        const kp = await kp_model_1.Kp.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!kp) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json(kp);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID или данные' });
    }
});
// DELETE /api/kp/:id
router.delete('/:id', async (req, res) => {
    try {
        await kp_model_1.Kp.findByIdAndDelete(req.params.id);
        res.status(204).send();
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
exports.default = router;

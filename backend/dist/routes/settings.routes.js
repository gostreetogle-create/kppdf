"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_model_1 = require("../models/settings.model");
const router = (0, express_1.Router)();
// Инициализация дефолтных настроек (если не существуют)
async function ensureDefaults() {
    for (const s of settings_model_1.DEFAULT_SETTINGS) {
        await settings_model_1.Setting.findOneAndUpdate({ key: s.key }, { $setOnInsert: s }, { upsert: true, new: true });
    }
}
// GET /api/settings — все настройки
router.get('/', async (_req, res) => {
    try {
        await ensureDefaults();
        const settings = await settings_model_1.Setting.find().sort({ key: 1 });
        // Возвращаем как объект { key: value } для удобства фронта
        const map = {};
        settings.forEach(s => { map[s.key] = s.value; });
        res.json({ list: settings, map });
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// PUT /api/settings/:key — обновить одну настройку
router.put('/:key', async (req, res) => {
    try {
        const setting = await settings_model_1.Setting.findOneAndUpdate({ key: req.params.key }, { value: req.body.value }, { new: true });
        if (!setting) {
            res.status(404).json({ message: 'Настройка не найдена' });
            return;
        }
        res.json(setting);
    }
    catch {
        res.status(400).json({ message: 'Ошибка обновления' });
    }
});
// PUT /api/settings — обновить несколько настроек сразу
router.put('/', async (req, res) => {
    try {
        const updates = req.body;
        const ops = Object.entries(updates).map(([key, value]) => settings_model_1.Setting.findOneAndUpdate({ key }, { value }, { new: true }));
        await Promise.all(ops);
        const settings = await settings_model_1.Setting.find().sort({ key: 1 });
        const map = {};
        settings.forEach(s => { map[s.key] = s.value; });
        res.json({ list: settings, map });
    }
    catch {
        res.status(400).json({ message: 'Ошибка обновления' });
    }
});
exports.default = router;

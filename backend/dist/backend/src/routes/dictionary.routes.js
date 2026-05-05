"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dictionary_model_1 = require("../models/dictionary.model");
const rbac_guard_1 = require("../middleware/rbac.guard");
const router = (0, express_1.Router)();
router.use((0, rbac_guard_1.requirePermission)('settings.write'));
// GET /api/dictionaries?type=category
router.get('/', async (req, res) => {
    try {
        const { type } = req.query;
        const filter = { isActive: true };
        if (type)
            filter.type = type;
        const list = await dictionary_model_1.Dictionary.find(filter).sort({ sortOrder: 1, value: 1 });
        res.json(list);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});
// POST /api/dictionaries
router.post('/', async (req, res) => {
    try {
        const item = await dictionary_model_1.Dictionary.create(req.body);
        res.status(201).json(item);
    }
    catch (e) {
        res.status(400).json({ message: e.message });
    }
});
// PUT /api/dictionaries/:id
router.put('/:id', async (req, res) => {
    try {
        const item = await dictionary_model_1.Dictionary.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!item) {
            res.status(404).json({ message: 'Не найдено' });
            return;
        }
        res.json(item);
    }
    catch (e) {
        res.status(400).json({ message: e.message });
    }
});
// DELETE /api/dictionaries/:id
router.delete('/:id', async (req, res) => {
    try {
        await dictionary_model_1.Dictionary.findByIdAndDelete(req.params.id);
        res.status(204).send();
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
});
exports.default = router;

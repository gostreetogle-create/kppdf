"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_model_1 = require("../models/settings.model");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const rbac_guard_1 = require("../middleware/rbac.guard");
const router = (0, express_1.Router)();
const backupRoot = process.env.BACKUP_ROOT || '/var/backups/kppdf';
const mongoBackupDir = path_1.default.join(backupRoot, 'mongo');
const mediaBackupDir = path_1.default.join(backupRoot, 'media');
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kp-app';
router.use((req, res, next) => {
    if (req.path.startsWith('/backups')) {
        return (0, rbac_guard_1.requirePermission)('backups.manage')(req, res, next);
    }
    return (0, rbac_guard_1.requirePermission)('settings.write')(req, res, next);
});
// Инициализация дефолтных настроек (если не существуют)
async function ensureDefaults() {
    for (const s of settings_model_1.DEFAULT_SETTINGS) {
        await settings_model_1.Setting.findOneAndUpdate({ key: s.key }, { $setOnInsert: s }, { upsert: true, new: true });
    }
}
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const proc = (0, child_process_1.spawn)(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
        proc.on('error', reject);
        proc.on('close', code => {
            if (code === 0)
                resolve();
            else
                reject(new Error(stderr || `${command} exited with code ${code}`));
        });
    });
}
function isSafeFilename(name) {
    return /^[a-z0-9._-]+$/i.test(name) && !name.includes('..');
}
async function ensureBackupDirs() {
    await promises_1.default.mkdir(mongoBackupDir, { recursive: true });
    await promises_1.default.mkdir(mediaBackupDir, { recursive: true });
}
async function listBackupFiles(dir, type) {
    const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    const rows = await Promise.all(entries
        .filter(entry => entry.isFile())
        .map(async (entry) => {
        const fullPath = path_1.default.join(dir, entry.name);
        const stat = await promises_1.default.stat(fullPath);
        return {
            filename: entry.name,
            type,
            sizeBytes: stat.size,
            createdAt: stat.mtime.toISOString()
        };
    }));
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
async function cleanupOldBackups(dir, keepDays) {
    const thresholdMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const entries = await promises_1.default.readdir(dir, { withFileTypes: true });
    let deleted = 0;
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        const fullPath = path_1.default.join(dir, entry.name);
        const stat = await promises_1.default.stat(fullPath);
        if (stat.mtime.getTime() < thresholdMs) {
            await promises_1.default.unlink(fullPath);
            deleted += 1;
        }
    }
    return deleted;
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
// GET /api/settings/backups — список бэкапов
router.get('/backups', async (_req, res) => {
    try {
        await ensureBackupDirs();
        const mongoFiles = await listBackupFiles(mongoBackupDir, 'mongo');
        const mediaFiles = await listBackupFiles(mediaBackupDir, 'media');
        res.json({ items: [...mongoFiles, ...mediaFiles].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    }
    catch (e) {
        res.status(500).json({ message: e?.message || 'Ошибка получения списка бэкапов' });
    }
});
// POST /api/settings/backups/run — создать бэкап сейчас
router.post('/backups/run', async (_req, res) => {
    try {
        await ensureBackupDirs();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const mongoFilename = `mongo-${stamp}.archive.gz`;
        const mediaFilename = `media-${stamp}.tar.gz`;
        await runCommand('mongodump', [
            `--uri=${mongoUri}`,
            `--archive=${path_1.default.join(mongoBackupDir, mongoFilename)}`,
            '--gzip'
        ]);
        await runCommand('tar', ['-czf', path_1.default.join(mediaBackupDir, mediaFilename), '-C', mediaRoot, '.']);
        res.status(201).json({
            message: 'Бэкап создан',
            files: { mongo: mongoFilename, media: mediaFilename }
        });
    }
    catch (e) {
        res.status(500).json({ message: e?.message || 'Не удалось создать бэкап' });
    }
});
// GET /api/settings/backups/download/:type/:filename — скачать архив
router.get('/backups/download/:type/:filename', async (req, res) => {
    try {
        const type = req.params.type;
        const filename = req.params.filename;
        if (type !== 'mongo' && type !== 'media') {
            res.status(400).json({ message: 'Неверный тип бэкапа' });
            return;
        }
        if (!isSafeFilename(filename)) {
            res.status(400).json({ message: 'Неверное имя файла' });
            return;
        }
        const dir = type === 'mongo' ? mongoBackupDir : mediaBackupDir;
        const fullPath = path_1.default.join(dir, filename);
        await promises_1.default.access(fullPath);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        (0, fs_1.createReadStream)(fullPath).pipe(res);
    }
    catch {
        res.status(404).json({ message: 'Файл бэкапа не найден' });
    }
});
// DELETE /api/settings/backups/:type/:filename — удалить архив
router.delete('/backups/:type/:filename', async (req, res) => {
    try {
        const type = req.params.type;
        const filename = req.params.filename;
        if (type !== 'mongo' && type !== 'media') {
            res.status(400).json({ message: 'Неверный тип бэкапа' });
            return;
        }
        if (!isSafeFilename(filename)) {
            res.status(400).json({ message: 'Неверное имя файла' });
            return;
        }
        const dir = type === 'mongo' ? mongoBackupDir : mediaBackupDir;
        const fullPath = path_1.default.join(dir, filename);
        await promises_1.default.unlink(fullPath);
        res.status(204).send();
    }
    catch {
        res.status(404).json({ message: 'Файл бэкапа не найден' });
    }
});
// DELETE /api/settings/backups/cleanup?days=7&type=all|mongo|media — удалить старые архивы
router.delete('/backups/cleanup', async (req, res) => {
    try {
        await ensureBackupDirs();
        const daysRaw = String(req.query.days ?? '7');
        const type = String(req.query.type ?? 'all');
        const keepDays = Number.parseInt(daysRaw, 10);
        if (!Number.isFinite(keepDays) || keepDays < 1 || keepDays > 3650) {
            res.status(400).json({ message: 'Параметр days должен быть числом от 1 до 3650' });
            return;
        }
        if (type !== 'all' && type !== 'mongo' && type !== 'media') {
            res.status(400).json({ message: 'Параметр type должен быть all|mongo|media' });
            return;
        }
        let deletedMongo = 0;
        let deletedMedia = 0;
        if (type === 'all' || type === 'mongo') {
            deletedMongo = await cleanupOldBackups(mongoBackupDir, keepDays);
        }
        if (type === 'all' || type === 'media') {
            deletedMedia = await cleanupOldBackups(mediaBackupDir, keepDays);
        }
        res.json({
            message: 'Очистка завершена',
            deleted: {
                mongo: deletedMongo,
                media: deletedMedia,
                total: deletedMongo + deletedMedia
            }
        });
    }
    catch (e) {
        res.status(500).json({ message: e?.message || 'Не удалось выполнить очистку бэкапов' });
    }
});
exports.default = router;

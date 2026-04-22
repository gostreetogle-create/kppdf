import { Router, Request, Response } from 'express';
import { Setting, DEFAULT_SETTINGS } from '../models/settings.model';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import { requirePermission } from '../middleware/rbac.guard';

const router = Router();
const backupRoot = process.env.BACKUP_ROOT || '/var/backups/kppdf';
const mongoBackupDir = path.join(backupRoot, 'mongo');
const mediaBackupDir = path.join(backupRoot, 'media');
const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/kp-app';

router.use((req, res, next) => {
  if (req.path.startsWith('/backups')) {
    return requirePermission('backups.manage')(req, res, next);
  }
  return requirePermission('settings.write')(req, res, next);
});

// Инициализация дефолтных настроек (если не существуют)
async function ensureDefaults() {
  for (const s of DEFAULT_SETTINGS) {
    await Setting.findOneAndUpdate(
      { key: s.key },
      { $setOnInsert: s },
      { upsert: true, new: true }
    );
  }
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

function isSafeFilename(name: string) {
  return /^[a-z0-9._-]+$/i.test(name) && !name.includes('..');
}

async function ensureBackupDirs() {
  await fs.mkdir(mongoBackupDir, { recursive: true });
  await fs.mkdir(mediaBackupDir, { recursive: true });
}

async function listBackupFiles(dir: string, type: 'mongo' | 'media') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const rows = await Promise.all(
    entries
      .filter(entry => entry.isFile())
      .map(async entry => {
        const fullPath = path.join(dir, entry.name);
        const stat = await fs.stat(fullPath);
        return {
          filename: entry.name,
          type,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      })
  );
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function cleanupOldBackups(dir: string, keepDays: number) {
  const thresholdMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let deleted = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    const stat = await fs.stat(fullPath);
    if (stat.mtime.getTime() < thresholdMs) {
      await fs.unlink(fullPath);
      deleted += 1;
    }
  }
  return deleted;
}

// GET /api/settings — все настройки
router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureDefaults();
    const settings = await Setting.find().sort({ key: 1 });
    // Возвращаем как объект { key: value } для удобства фронта
    const map: Record<string, unknown> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ list: settings, map });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/settings/:key — обновить одну настройку
router.put('/:key', async (req: Request, res: Response) => {
  try {
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { value: req.body.value },
      { new: true }
    );
    if (!setting) { res.status(404).json({ message: 'Настройка не найдена' }); return; }
    res.json(setting);
  } catch {
    res.status(400).json({ message: 'Ошибка обновления' });
  }
});

// PUT /api/settings — обновить несколько настроек сразу
router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, unknown>;
    const ops = Object.entries(updates).map(([key, value]) =>
      Setting.findOneAndUpdate({ key }, { value }, { new: true })
    );
    await Promise.all(ops);
    const settings = await Setting.find().sort({ key: 1 });
    const map: Record<string, unknown> = {};
    settings.forEach(s => { map[s.key] = s.value; });
    res.json({ list: settings, map });
  } catch {
    res.status(400).json({ message: 'Ошибка обновления' });
  }
});

// GET /api/settings/backups — список бэкапов
router.get('/backups', async (_req: Request, res: Response) => {
  try {
    await ensureBackupDirs();
    const mongoFiles = await listBackupFiles(mongoBackupDir, 'mongo');
    const mediaFiles = await listBackupFiles(mediaBackupDir, 'media');
    res.json({ items: [...mongoFiles, ...mediaFiles].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Ошибка получения списка бэкапов' });
  }
});

// POST /api/settings/backups/run — создать бэкап сейчас
router.post('/backups/run', async (_req: Request, res: Response) => {
  try {
    await ensureBackupDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mongoFilename = `mongo-${stamp}.archive.gz`;
    const mediaFilename = `media-${stamp}.tar.gz`;

    await runCommand('mongodump', [
      `--uri=${mongoUri}`,
      `--archive=${path.join(mongoBackupDir, mongoFilename)}`,
      '--gzip'
    ]);

    await runCommand('tar', ['-czf', path.join(mediaBackupDir, mediaFilename), '-C', mediaRoot, '.']);

    res.status(201).json({
      message: 'Бэкап создан',
      files: { mongo: mongoFilename, media: mediaFilename }
    });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Не удалось создать бэкап' });
  }
});

// GET /api/settings/backups/download/:type/:filename — скачать архив
router.get('/backups/download/:type/:filename', async (req: Request, res: Response) => {
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
    const fullPath = path.join(dir, filename);
    await fs.access(fullPath);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    createReadStream(fullPath).pipe(res);
  } catch {
    res.status(404).json({ message: 'Файл бэкапа не найден' });
  }
});

// DELETE /api/settings/backups/:type/:filename — удалить архив
router.delete('/backups/:type/:filename', async (req: Request, res: Response) => {
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
    const fullPath = path.join(dir, filename);
    await fs.unlink(fullPath);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Файл бэкапа не найден' });
  }
});

// DELETE /api/settings/backups/cleanup?days=7&type=all|mongo|media — удалить старые архивы
router.delete('/backups/cleanup', async (req: Request, res: Response) => {
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
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'Не удалось выполнить очистку бэкапов' });
  }
});

export default router;

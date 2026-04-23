import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requirePermission } from '../middleware/rbac.guard';
import { requireRole } from '../middleware/auth.middleware';
import {
  getProductSpecByProductId,
  getProductSpecTemplates,
  upsertProductSpecByProductId,
  uploadProductSpecDrawing
} from '../controllers/product-spec.controller';

const router = Router();
const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
const specsMediaDir = path.join(mediaRoot, 'specs');
if (!fs.existsSync(specsMediaDir)) fs.mkdirSync(specsMediaDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, specsMediaDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.png';
      cb(null, `spec-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
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

router.use((req, res, next) => {
  const isRead = req.method === 'GET';
  return requirePermission(isRead ? 'products.view' : 'products.write')(req, res, next);
});

// POST /api/product-specs/upload-drawing
router.post('/upload-drawing', requireRole('owner', 'admin'), (req: Request, res: Response) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) {
      res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
      return;
    }
    uploadProductSpecDrawing(req, res);
  });
});

// Backward-compatible alias for existing clients.
router.post('/upload', requireRole('owner', 'admin'), (req: Request, res: Response) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err) {
      res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
      return;
    }
    uploadProductSpecDrawing(req, res);
  });
});

// Backward-compatible aliases for existing clients.
router.get('/product/:productId', getProductSpecByProductId);
router.put('/product/:productId', requireRole('owner', 'admin'), upsertProductSpecByProductId);

// GET /api/product-specs/templates
router.get('/templates', getProductSpecTemplates);

// GET /api/product-specs/:productId
router.get('/:productId', getProductSpecByProductId);

// PUT /api/product-specs/:productId
router.put('/:productId', requireRole('owner', 'admin'), upsertProductSpecByProductId);

export default router;

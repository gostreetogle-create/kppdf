import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.guard';
import {
  createKp,
  createKpVersion,
  deleteKp,
  duplicateKp,
  exportKpPdf,
  previewKpPdf,
  exportProductPassportPdf,
  previewProductPassportPdf,
  getKpById,
  listKpVersions,
  listKp,
  switchKpType,
  updateKp
} from '../controllers/kp.controller';

const router = Router();
router.use((req, res, next) => {
  if (req.method === 'GET') return requirePermission('kp.view')(req, res, next);
  if (req.method === 'POST') return requirePermission('kp.create')(req, res, next);
  if (req.method === 'PUT' || req.method === 'PATCH') return requirePermission('kp.edit')(req, res, next);
  if (req.method === 'DELETE') return requirePermission('kp.delete')(req, res, next);
  next();
});

// GET /api/kp
router.get('/', listKp);

// POST /api/kp — создать черновик с дефолтами из Settings
router.post('/', createKp);

// POST /api/kp/:id/duplicate
router.post('/:id/duplicate', duplicateKp);

// PUT /api/kp/:id/switch-type
router.put('/:id/switch-type', switchKpType);

// GET /api/kp/:id/export
router.get('/:id/export', exportKpPdf);

// GET /api/kp/:id/preview
router.get('/:id/preview', previewKpPdf);

// GET /api/kp/passport/:productId/export
router.get('/passport/:productId/export', exportProductPassportPdf);

// GET /api/kp/passport/:productId/preview
router.get('/passport/:productId/preview', previewProductPassportPdf);

// GET /api/kp/:id
// GET /api/kp/:id/versions
router.get('/:id/versions', listKpVersions);

// POST /api/kp/:id/versions
router.post('/:id/versions', createKpVersion);

router.get('/:id', getKpById);

// PUT /api/kp/:id
router.put('/:id', updateKp);

// DELETE /api/kp/:id
router.delete('/:id', deleteKp);

export default router;

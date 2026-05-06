"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_guard_1 = require("../middleware/rbac.guard");
const kp_controller_1 = require("../controllers/kp.controller");
const router = (0, express_1.Router)();
router.use((req, res, next) => {
    if (req.method === 'GET')
        return (0, rbac_guard_1.requirePermission)('kp.view')(req, res, next);
    if (req.method === 'POST')
        return (0, rbac_guard_1.requirePermission)('kp.create')(req, res, next);
    if (req.method === 'PUT' || req.method === 'PATCH')
        return (0, rbac_guard_1.requirePermission)('kp.edit')(req, res, next);
    if (req.method === 'DELETE')
        return (0, rbac_guard_1.requirePermission)('kp.delete')(req, res, next);
    next();
});
// GET /api/kp
router.get('/', kp_controller_1.listKp);
// POST /api/kp — создать черновик с дефолтами из Settings
router.post('/', kp_controller_1.createKp);
// POST /api/kp/:id/duplicate
router.post('/:id/duplicate', kp_controller_1.duplicateKp);
// PUT /api/kp/:id/switch-type
router.put('/:id/switch-type', kp_controller_1.switchKpType);
// GET /api/kp/:id/export
router.get('/:id/export', kp_controller_1.exportKpPdf);
// GET /api/kp/:id/preview
router.get('/:id/preview', kp_controller_1.previewKpPdf);
// GET /api/kp/passport/:productId/export
router.get('/passport/:productId/export', kp_controller_1.exportProductPassportPdf);
// GET /api/kp/passport/:productId/preview
router.get('/passport/:productId/preview', kp_controller_1.previewProductPassportPdf);
// GET /api/kp/:id
// GET /api/kp/:id/versions
router.get('/:id/versions', kp_controller_1.listKpVersions);
// POST /api/kp/:id/versions
router.post('/:id/versions', kp_controller_1.createKpVersion);
router.get('/:id', kp_controller_1.getKpById);
// PUT /api/kp/:id
router.put('/:id', kp_controller_1.updateKp);
// DELETE /api/kp/:id
router.delete('/:id', kp_controller_1.deleteKp);
exports.default = router;

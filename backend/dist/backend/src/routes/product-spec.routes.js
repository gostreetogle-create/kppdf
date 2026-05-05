"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const rbac_guard_1 = require("../middleware/rbac.guard");
const auth_middleware_1 = require("../middleware/auth.middleware");
const product_spec_controller_1 = require("../controllers/product-spec.controller");
const router = (0, express_1.Router)();
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
const specsMediaDir = path_1.default.join(mediaRoot, 'specs');
if (!fs_1.default.existsSync(specsMediaDir))
    fs_1.default.mkdirSync(specsMediaDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, specsMediaDir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || '').toLowerCase() || '.png';
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
    return (0, rbac_guard_1.requirePermission)(isRead ? 'products.view' : 'products.write')(req, res, next);
});
// POST /api/product-specs/upload-drawing
router.post('/upload-drawing', (0, auth_middleware_1.requireRole)('owner', 'admin'), (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
            return;
        }
        (0, product_spec_controller_1.uploadProductSpecDrawing)(req, res);
    });
});
// Backward-compatible alias for existing clients.
router.post('/upload', (0, auth_middleware_1.requireRole)('owner', 'admin'), (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            res.status(400).json({ message: err.message || 'Ошибка загрузки файла' });
            return;
        }
        (0, product_spec_controller_1.uploadProductSpecDrawing)(req, res);
    });
});
// Backward-compatible aliases for existing clients.
router.get('/product/:productId', product_spec_controller_1.getProductSpecByProductId);
router.put('/product/:productId', (0, auth_middleware_1.requireRole)('owner', 'admin'), product_spec_controller_1.upsertProductSpecByProductId);
// GET /api/product-specs/templates
router.get('/templates', product_spec_controller_1.getProductSpecTemplates);
// GET /api/product-specs/:productId
router.get('/:productId', product_spec_controller_1.getProductSpecByProductId);
// PUT /api/product-specs/:productId
router.put('/:productId', (0, auth_middleware_1.requireRole)('owner', 'admin'), product_spec_controller_1.upsertProductSpecByProductId);
exports.default = router;

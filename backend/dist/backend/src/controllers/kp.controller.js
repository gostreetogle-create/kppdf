"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listKp = listKp;
exports.createKp = createKp;
exports.duplicateKp = duplicateKp;
exports.createKpRevision = createKpRevision;
exports.switchKpType = switchKpType;
exports.getKpById = getKpById;
exports.listKpVersions = listKpVersions;
exports.createKpVersion = createKpVersion;
exports.updateKp = updateKp;
exports.deleteKp = deleteKp;
exports.exportKpPdf = exportKpPdf;
exports.previewKpPdf = previewKpPdf;
exports.exportProductPassportPdf = exportProductPassportPdf;
exports.previewProductPassportPdf = previewProductPassportPdf;
const kp_service_1 = require("../services/kp.service");
const pdf_generator_service_1 = require("../services/pdf-generator.service");
const product_passport_pdf_service_1 = require("../services/product-passport-pdf.service");
const kp_dto_1 = require("../dtos/kp.dto");
function validationMessage(error) {
    return typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Неверный ID или данные';
}
async function listKp(_req, res) {
    try {
        const list = await kp_service_1.kpService.list();
        res.json(list.map(kp_dto_1.mapKpToDto));
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}
async function createKp(req, res) {
    try {
        const kp = await kp_service_1.kpService.create(req.body);
        res.status(201).json((0, kp_dto_1.mapKpToDto)(kp));
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function duplicateKp(req, res) {
    try {
        const duplicate = await kp_service_1.kpService.duplicate(req.params.id);
        if (!duplicate) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(201).json((0, kp_dto_1.mapKpToDto)(duplicate));
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function createKpRevision(req, res) {
    try {
        const revision = await kp_service_1.kpService.createRevision(req.params.id);
        if (!revision) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(201).json((0, kp_dto_1.mapKpToDto)(revision));
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function switchKpType(req, res) {
    try {
        const result = await kp_service_1.kpService.switchType(req.params.id, req.body);
        if (!result) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        // Возвращаем объект с отмаппленным КП и метаданными
        res.json({
            kp: (0, kp_dto_1.mapKpToDto)(result.kp),
            meta: result.meta
        });
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function getKpById(req, res) {
    try {
        const rawVersion = req.query.version;
        const requestedVersion = typeof rawVersion === 'string' && rawVersion.trim()
            ? Number(rawVersion)
            : undefined;
        if (requestedVersion && Number.isFinite(requestedVersion)) {
            const snapshot = await kp_service_1.kpService.getVersionSnapshot(req.params.id, requestedVersion);
            if (!snapshot) {
                res.status(404).json({ message: 'Not found' });
                return;
            }
            res.json(snapshot);
            return;
        }
        const kp = await kp_service_1.kpService.getById(req.params.id);
        if (!kp) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json((0, kp_dto_1.mapKpToDto)(kp));
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
}
async function listKpVersions(req, res) {
    try {
        const versions = await kp_service_1.kpService.listVersions(req.params.id);
        if (!versions) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json({ items: versions });
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function createKpVersion(req, res) {
    try {
        const kp = await kp_service_1.kpService.createVersion(req.params.id);
        if (!kp) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.status(201).json((0, kp_dto_1.mapKpToDto)(kp));
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function updateKp(req, res) {
    try {
        const updated = await kp_service_1.kpService.updateKp(req.params.id, req.body);
        if (!updated) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json((0, kp_dto_1.mapKpToDto)(updated));
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function deleteKp(req, res) {
    try {
        await kp_service_1.kpService.remove(req.params.id);
        res.status(204).send();
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
}
async function exportKpPdf(req, res) {
    await handlePdfExport(req, res, 'attachment');
}
async function previewKpPdf(req, res) {
    await handlePdfExport(req, res, 'inline');
}
async function handlePdfExport(req, res, disposition) {
    try {
        const rawVersion = req.query.version;
        const requestedVersion = typeof rawVersion === 'string' && rawVersion.trim()
            ? Number(rawVersion)
            : undefined;
        const resolvedVersion = requestedVersion && Number.isFinite(requestedVersion)
            ? requestedVersion
            : undefined;
        let kpDto = null;
        if (resolvedVersion) {
            kpDto = await kp_service_1.kpService.getVersionSnapshot(req.params.id, resolvedVersion);
            if (!kpDto) {
                res.status(404).json({ message: 'КП не найдено' });
                return;
            }
        }
        else {
            const kp = await kp_service_1.kpService.getById(req.params.id);
            if (!kp) {
                res.status(404).json({ message: 'КП не найдено' });
                return;
            }
            kpDto = (0, kp_dto_1.mapKpToDto)(kp);
        }
        const accessToken = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice('Bearer '.length)
            : undefined;
        const pdfBuffer = await pdf_generator_service_1.pdfGeneratorService.generateKpPdf({
            kpId: req.params.id,
            accessToken,
            version: resolvedVersion
        });
        const docNumber = String(kpDto.metadata?.number ?? req.params.id).replace(/[^\w.-]+/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposition}; filename="kp-${docNumber}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ message: 'Не удалось сформировать PDF' });
    }
}
async function exportProductPassportPdf(req, res) {
    await handlePassportExport(req, res, 'attachment');
}
async function previewProductPassportPdf(req, res) {
    await handlePassportExport(req, res, 'inline');
}
async function handlePassportExport(req, res, disposition) {
    try {
        const { pdf, filename } = await product_passport_pdf_service_1.productPassportPdfService.generateByProductId(req.params.productId);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
        res.send(pdf);
    }
    catch (error) {
        const message = String(error?.message ?? '');
        if (message.includes('не найден')) {
            res.status(404).json({ message });
            return;
        }
        res.status(500).json({ message: 'Не удалось сформировать технический паспорт' });
    }
}

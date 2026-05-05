"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listKp = listKp;
exports.createKp = createKp;
exports.duplicateKp = duplicateKp;
exports.switchKpType = switchKpType;
exports.getKpById = getKpById;
exports.updateKp = updateKp;
exports.deleteKp = deleteKp;
exports.exportKpPdf = exportKpPdf;
exports.previewKpPdf = previewKpPdf;
exports.exportProductPassportPdf = exportProductPassportPdf;
exports.previewProductPassportPdf = previewProductPassportPdf;
const kp_service_1 = require("../services/kp.service");
const pdf_generator_service_1 = require("../services/pdf-generator.service");
const product_passport_pdf_service_1 = require("../services/product-passport-pdf.service");
function validationMessage(error) {
    return typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Неверный ID или данные';
}
async function listKp(_req, res) {
    try {
        const list = await kp_service_1.kpService.list();
        res.json(list);
    }
    catch {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}
async function createKp(req, res) {
    try {
        const kp = await kp_service_1.kpService.create(req.body);
        res.status(201).json(kp);
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
        res.status(201).json(duplicate);
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
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ message: validationMessage(error) });
    }
}
async function getKpById(req, res) {
    try {
        const kp = await kp_service_1.kpService.getById(req.params.id);
        if (!kp) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json(kp);
    }
    catch {
        res.status(400).json({ message: 'Неверный ID' });
    }
}
async function updateKp(req, res) {
    try {
        const existing = await kp_service_1.kpService.getById(req.params.id);
        if (!existing) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        const updated = await kp_service_1.kpService.updateKp(req.params.id, req.body);
        if (!updated) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        res.json(updated);
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
        const kp = await kp_service_1.kpService.getById(req.params.id);
        if (!kp) {
            res.status(404).json({ message: 'КП не найдено' });
            return;
        }
        const accessToken = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice('Bearer '.length)
            : undefined;
        const pdfBuffer = await pdf_generator_service_1.pdfGeneratorService.generateKpPdf({ kpId: req.params.id, accessToken });
        const docNumber = String(kp.metadata?.number ?? req.params.id).replace(/[^\w.-]+/g, '_');
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

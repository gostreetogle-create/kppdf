import { Request, Response } from 'express';
import { kpService } from '../services/kp.service';
import { pdfGeneratorService } from '../services/pdf-generator.service';
import { productPassportPdfService } from '../services/product-passport-pdf.service';

function validationMessage(error: any): string {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Неверный ID или данные';
}

export async function listKp(_req: Request, res: Response) {
  try {
    const list = await kpService.list();
    res.json(list);
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
}

export async function createKp(req: Request, res: Response) {
  try {
    const kp = await kpService.create(req.body);
    res.status(201).json(kp);
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function duplicateKp(req: Request, res: Response) {
  try {
    const duplicate = await kpService.duplicate(req.params.id);
    if (!duplicate) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.status(201).json(duplicate);
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function switchKpType(req: Request, res: Response) {
  try {
    const result = await kpService.switchType(req.params.id, req.body);
    if (!result) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function getKpById(req: Request, res: Response) {
  try {
    const kp = await kpService.getById(req.params.id);
    if (!kp) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json(kp);
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
}

export async function updateKp(req: Request, res: Response) {
  try {
    const existing = await kpService.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const updated = await kpService.updateKp(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function deleteKp(req: Request, res: Response) {
  try {
    await kpService.remove(req.params.id);
    res.status(204).send();
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
}

export async function exportKpPdf(req: Request, res: Response) {
  try {
    const kp = await kpService.getById(req.params.id);
    if (!kp) {
      res.status(404).json({ message: 'КП не найдено' });
      return;
    }

    const accessToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : undefined;
    const pdfBuffer = await pdfGeneratorService.generateKpPdf({ kpId: req.params.id, accessToken });
    const docNumber = String(kp.metadata?.number ?? req.params.id).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kp-${docNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch {
    res.status(500).json({ message: 'Не удалось сформировать PDF' });
  }
}

export async function exportProductPassportPdf(req: Request, res: Response) {
  try {
    const { pdf, filename } = await productPassportPdfService.generateByProductId(req.params.productId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (message.includes('не найден')) {
      res.status(404).json({ message });
      return;
    }
    res.status(500).json({ message: 'Не удалось сформировать технический паспорт' });
  }
}

import { Request, Response } from 'express';
import { kpService } from '../services/kp.service';
import { pdfGeneratorService } from '../services/pdf-generator.service';
import { productPassportPdfService } from '../services/product-passport-pdf.service';
import { mapKpToDto } from '../dtos/kp.dto';

function validationMessage(error: any): string {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'Неверный ID или данные';
}

export async function listKp(_req: Request, res: Response) {
  try {
    const list = await kpService.list();
    res.json(list.map(mapKpToDto));
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
}

export async function createKp(req: Request, res: Response) {
  try {
    const kp = await kpService.create(req.body);
    res.status(201).json(mapKpToDto(kp));
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
    res.status(201).json(mapKpToDto(duplicate));
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function createKpRevision(req: Request, res: Response) {
  try {
    const revision = await kpService.createRevision(req.params.id);
    if (!revision) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.status(201).json(mapKpToDto(revision));
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
    // Возвращаем объект с отмаппленным КП и метаданными
    res.json({
      kp: mapKpToDto(result.kp),
      meta: result.meta
    });
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function getKpById(req: Request, res: Response) {
  try {
    const rawVersion = req.query.version;
    const requestedVersion = typeof rawVersion === 'string' && rawVersion.trim()
      ? Number(rawVersion)
      : undefined;
    if (requestedVersion && Number.isFinite(requestedVersion)) {
      const snapshot = await kpService.getVersionSnapshot(req.params.id, requestedVersion);
      if (!snapshot) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      res.json(snapshot);
      return;
    }
    const kp = await kpService.getById(req.params.id);
    if (!kp) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json(mapKpToDto(kp));
  } catch {
    res.status(400).json({ message: 'Неверный ID' });
  }
}

export async function listKpVersions(req: Request, res: Response) {
  try {
    const versions = await kpService.listVersions(req.params.id);
    if (!versions) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json({ items: versions });
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function createKpVersion(req: Request, res: Response) {
  try {
    const kp = await kpService.createVersion(req.params.id);
    if (!kp) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.status(201).json(mapKpToDto(kp));
  } catch (error: any) {
    res.status(400).json({ message: validationMessage(error) });
  }
}

export async function updateKp(req: Request, res: Response) {
  try {
    const updated = await kpService.updateKp(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json(mapKpToDto(updated));
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
  await handlePdfExport(req, res, 'attachment');
}

export async function previewKpPdf(req: Request, res: Response) {
  await handlePdfExport(req, res, 'inline');
}

async function handlePdfExport(req: Request, res: Response, disposition: 'attachment' | 'inline') {
  try {
    const rawVersion = req.query.version;
    const requestedVersion = typeof rawVersion === 'string' && rawVersion.trim()
      ? Number(rawVersion)
      : undefined;
    const resolvedVersion = requestedVersion && Number.isFinite(requestedVersion)
      ? requestedVersion
      : undefined;

    let kpDto: any = null;
    if (resolvedVersion) {
      kpDto = await kpService.getVersionSnapshot(req.params.id, resolvedVersion);
      if (!kpDto) {
        res.status(404).json({ message: 'КП не найдено' });
        return;
      }
    } else {
      const kp = await kpService.getById(req.params.id);
      if (!kp) {
        res.status(404).json({ message: 'КП не найдено' });
        return;
      }
      kpDto = mapKpToDto(kp);
    }

    const accessToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length)
      : undefined;
    const pdfBuffer = await pdfGeneratorService.generateKpPdf({
      kpId: req.params.id,
      accessToken,
      version: resolvedVersion
    } as any);
    const docNumber = String(kpDto.metadata?.number ?? req.params.id).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="kp-${docNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: 'Не удалось сформировать PDF' });
  }
}

export async function exportProductPassportPdf(req: Request, res: Response) {
  await handlePassportExport(req, res, 'attachment');
}

export async function previewProductPassportPdf(req: Request, res: Response) {
  await handlePassportExport(req, res, 'inline');
}

async function handlePassportExport(req: Request, res: Response, disposition: 'attachment' | 'inline') {
  try {
    const { pdf, filename } = await productPassportPdfService.generateByProductId(req.params.productId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
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

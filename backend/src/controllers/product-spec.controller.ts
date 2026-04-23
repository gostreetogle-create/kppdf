import { Request, Response } from 'express';
import { productSpecService } from '../services/product-spec.service';

function resolveErrorStatus(message: string): number {
  return /найден|обязателен/i.test(message) ? 400 : 500;
}

export async function getProductSpecByProductId(req: Request, res: Response) {
  try {
    const spec = await productSpecService.getSpecByProductId(req.params.productId);
    if (!spec) {
      res.status(200).json(null);
      return;
    }
    res.json(spec);
  } catch {
    res.status(400).json({ message: 'Неверный ID товара' });
  }
}

export async function upsertProductSpecByProductId(req: Request, res: Response) {
  try {
    const updated = await productSpecService.upsertSpec(req.params.productId, req.body);
    res.json(updated);
  } catch (error: any) {
    const message = error?.message || 'Ошибка сохранения профиля';
    res.status(resolveErrorStatus(String(message))).json({ message });
  }
}

export async function getProductSpecTemplates(_req: Request, res: Response) {
  try {
    const templates = await productSpecService.getTemplates();
    res.json(templates);
  } catch {
    res.status(500).json({ message: 'Не удалось получить шаблоны техпаспорта' });
  }
}

export function uploadProductSpecDrawing(req: Request, res: Response) {
  const file = (req as Request & { file?: { filename?: string } }).file;
  if (!file?.filename) {
    res.status(400).json({ message: 'Файл не передан' });
    return;
  }
  res.json({ url: `/media/specs/${file.filename}` });
}

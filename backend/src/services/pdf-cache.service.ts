import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class PdfCacheService {
  private cacheDir = path.resolve(process.cwd(), 'temp', 'storage');

  constructor() {
    this.ensureDir();
  }

  private async ensureDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (err) {
      // ignore
    }
  }

  /**
   * Генерирует путь к кешированному файлу на основе ID сущности и даты её последнего обновления.
   * Если дата меняется, путь будет другим, что автоматически инвалидирует кеш.
   */
  getCachePath(entityId: string, updatedAt: Date | string | number, prefix: string = 'kp'): string {
    const timestamp = new Date(updatedAt).getTime();
    const hash = crypto.createHash('md5').update(`${entityId}_${timestamp}`).digest('hex');
    return path.join(this.cacheDir, `${prefix}_${entityId}_${hash}.pdf`);
  }

  /**
   * Пытается прочитать файл из кеша.
   */
  async get(cachePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(cachePath);
    } catch {
      return null;
    }
  }

  /**
   * Сохраняет Buffer в кеш.
   */
  async set(cachePath: string, buffer: Buffer): Promise<void> {
    try {
      await this.ensureDir();
      await fs.writeFile(cachePath, buffer);
      
      // Опционально: можно добавить очистку старых версий этого же entityId
      this.cleanupOldVersions(cachePath);
    } catch (err) {
      console.error('Ошибка при записи PDF в кеш:', err);
    }
  }

  /**
   * Удаляет старые версии кеша для той же сущности, чтобы не забивать диск.
   */
  private async cleanupOldVersions(currentCachePath: string) {
    try {
      const fileName = path.basename(currentCachePath);
      const parts = fileName.split('_');
      if (parts.length < 3) return;
      
      const prefix = parts[0];
      const entityId = parts[1];
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (file.startsWith(`${prefix}_${entityId}_`) && file !== fileName) {
          await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
        }
      }
    } catch (err) {
      // ignore cleanup errors
    }
  }
}

export const pdfCacheService = new PdfCacheService();

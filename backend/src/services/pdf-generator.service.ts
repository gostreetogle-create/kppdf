import { Browser } from 'puppeteer';
import { puppeteerService } from './puppeteer.service';
import { pdfCacheService } from './pdf-cache.service';
import { Kp } from '../models/kp.model';

interface GenerateKpPdfInput {
  kpId: string;
  accessToken?: string;
  version?: number;
}

export class PdfGeneratorService {
  private getFrontendBaseUrl(): string {
    return process.env.FRONTEND_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:4200';
  }

  private getPdfAssetBaseUrl(): string | null {
    const raw = process.env.PDF_ASSET_BASE_URL?.trim();
    if (!raw) return null;
    return raw.replace(/\/$/, '');
  }

  async generateKpPdf(input: GenerateKpPdfInput): Promise<Buffer> {
    const kp = await Kp.findById(input.kpId).select('updatedAt metadata.createdAt versions').lean();
    const resolvedVersion = typeof input.version === 'number' && Number.isFinite(input.version)
      ? input.version
      : undefined;
    const versionEntry = resolvedVersion && Array.isArray((kp as any)?.versions)
      ? (kp as any).versions.find((v: any) => Number(v?.version) === resolvedVersion)
      : null;
    if (resolvedVersion && !versionEntry) {
      throw new Error('Версия КП не найдена');
    }

    const updatedAt = versionEntry?.createdAt
      || kp?.updatedAt
      || (kp as any)?.metadata?.createdAt
      || new Date();
    const cacheKey = resolvedVersion ? `kp-full-v${resolvedVersion}` : 'kp-full';
    const cachePath = pdfCacheService.getCachePath(input.kpId, updatedAt, cacheKey);

    const cached = await pdfCacheService.get(cachePath);
    if (cached) return cached;

    const browser = await puppeteerService.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1440, height: 2000, deviceScaleFactor: 2 });

      if (input.accessToken) {
        await page.evaluateOnNewDocument((token) => {
          window.localStorage.setItem('kp_access_token', token);
          window.localStorage.removeItem('kp_refresh_token');
        }, input.accessToken);
      }

      const versionParam = resolvedVersion ? `&version=${encodeURIComponent(String(resolvedVersion))}` : '';
      const targetUrl = `${this.getFrontendBaseUrl().replace(/\/$/, '')}/kp/${encodeURIComponent(input.kpId)}?pdf=1${versionParam}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });

      // Wait until Angular renders document preview.
      await page.waitForSelector('app-kp-document', { timeout: 30000 });
      await page.waitForFunction(
        () => document.querySelectorAll('app-kp-document').length > 0,
        { timeout: 30000 }
      );

      const assetBaseUrl = this.getPdfAssetBaseUrl();
      if (assetBaseUrl) {
        await page.evaluate((baseUrl) => {
          document.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
            const src = img.getAttribute('src');
            if (!src || !src.startsWith('/')) return;
            img.src = `${baseUrl}${src}`;
          });
        }, assetBaseUrl);
      }

      // Mark export mode for CSS-driven cleanup of interactive UI.
      await page.evaluate(() => {
        const root = document.documentElement;
        root.setAttribute('data-pdf-export', 'true');
        root.style.setProperty('--is-pdf-export', 'true');
        root.classList.add('ready-to-print');
      });

      // Ensure logos/product images are loaded before generating PDF.
      await page.waitForFunction(
        () => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0),
        { timeout: 30000 }
      );

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm'
        }
      });
      
      const buffer = Buffer.from(pdf);
      await pdfCacheService.set(cachePath, buffer);
      return buffer;
    } finally {
      await page.close();
    }
  }
}

export const pdfGeneratorService = new PdfGeneratorService();

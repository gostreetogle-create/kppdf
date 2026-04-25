import { puppeteerService } from './puppeteer.service';
import { pdfCacheService } from './pdf-cache.service';
import { Product } from '../models/product.model';
import { ProductSpec } from '../models/product-spec.model';
import { DEFAULT_SETTINGS, Setting } from '../models/settings.model';

interface PassportConstants {
  warranty: string;
  storage: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAssetBaseUrl(): string | null {
  const pdfAssetBase = process.env.PDF_ASSET_BASE_URL?.trim();
  if (pdfAssetBase) return pdfAssetBase.replace(/\/$/, '');
  const frontendBase = process.env.FRONTEND_BASE_URL?.trim() || process.env.CORS_ORIGIN?.trim();
  if (frontendBase) return frontendBase.replace(/\/$/, '');
  return null;
}

function resolveAssetUrl(url?: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || /^data:/i.test(url)) return url;
  const baseUrl = resolveAssetBaseUrl();
  if (!baseUrl) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function renderPassportHtml(input: {
  product: any;
  spec: any;
  constants: PassportConstants;
}): string {
  const { product, spec, constants } = input;
  const groups = Array.isArray(spec?.groups) ? spec.groups : [];
  const drawings = spec?.drawings ?? {};
  const drawingBlocks = [
    { title: 'Вид спереди', url: drawings.viewFront },
    { title: 'Вид сбоку', url: drawings.viewSide },
    { title: 'Вид сверху', url: drawings.viewTop },
    { title: '3D вид', url: drawings.view3D }
  ];

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(product.name)} — технический паспорт</title>
    <style>
      @page { 
        size: A4; 
        margin: 18mm 10mm 16mm 10mm; 
      }
      * { box-sizing: border-box; }
      body { 
        margin: 0; 
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; 
        color: #111827; 
        line-height: 1.5;
      }
      .page { 
        width: 100%;
        page-break-after: always; 
        break-after: page; 
        display: flex; 
        flex-direction: column; 
      }
      .page:last-child { page-break-after: auto; break-after: auto; }
      .title { margin-top: 15mm; text-align: center; }
      .title h1 { font-size: 28px; margin: 0 0 8px; color: #111827; font-weight: 800; letter-spacing: -0.02em; }
      .title h2 { font-size: 18px; margin: 0; color: #4b5563; font-weight: 500; }
      .sheet-meta { margin-top: 20mm; border-top: 1px solid #f3f4f6; padding-top: 10mm; display: grid; gap: 10px; max-width: 140mm; }
      .meta-row { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; }
      .meta-row strong { font-weight: 600; color: #111827; }
      .section-title { margin: 0 0 6mm; font-size: 20px; color: #111827; font-weight: 700; }
      .spec-section { margin-bottom: 6mm; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
      .spec-section h3 { margin: 0; padding: 8px 12px; font-size: 13px; background: #f9fafb; color: #374151; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      td:first-child { width: 40%; color: #6b7280; }
      td:last-child { font-weight: 500; color: #111827; }
      .drawings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
      .drawing-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; min-height: 60mm; display: flex; flex-direction: column; }
      .drawing-card h3 { margin: 0; padding: 8px 10px; font-size: 12px; background: #f9fafb; color: #4b5563; font-weight: 600; }
      .drawing-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; background: #fff; }
      .drawing-body img { max-width: 100%; max-height: 50mm; object-fit: contain; }
      .drawing-empty { font-size: 11px; color: #9ca3af; font-style: italic; }
      .constants { margin-top: auto; border-top: 1px solid #f3f4f6; padding-top: 8mm; display: grid; gap: 6mm; }
      .constants h3 { margin: 0 0 2mm; font-size: 14px; color: #111827; font-weight: 700; }
      .constants p { margin: 0; font-size: 12px; line-height: 1.6; color: #4b5563; }
    </style>
  </head>
  <body>
    <section class="page">
      <div class="title">
        <h1>Технический паспорт</h1>
        <h2>${escapeHtml(product.name)}</h2>
      </div>
      <div class="sheet-meta">
        <div class="meta-row"><span>Артикул</span><strong>${escapeHtml(product.code)}</strong></div>
        <div class="meta-row"><span>Категория</span><strong>${escapeHtml(product.category || '—')}</strong></div>
        <div class="meta-row"><span>Ед. измерения</span><strong>${escapeHtml(product.unit || '—')}</strong></div>
      </div>
    </section>

    <section class="page">
      <h2 class="section-title">Характеристики</h2>
      ${groups.map((group: any) => `
        <div class="spec-section">
          <h3>${escapeHtml(group?.title || 'Раздел')}</h3>
          <table>
            <tbody>
              ${(Array.isArray(group?.params) ? group.params : []).map((param: any) => `
                <tr>
                  <td>${escapeHtml(param?.name || '')}</td>
                  <td>${escapeHtml(param?.value || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </section>

    <section class="page">
      <h2 class="section-title">Чертежи и виды</h2>
      <div class="drawings-grid">
        ${drawingBlocks.map((drawing) => `
          <article class="drawing-card">
            <h3>${escapeHtml(drawing.title)}</h3>
            <div class="drawing-body">
              ${drawing.url ? `<img src="${escapeHtml(resolveAssetUrl(drawing.url))}" alt="${escapeHtml(drawing.title)}" />` : '<span class="drawing-empty">Изображение не загружено</span>'}
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="page">
      <h2 class="section-title">Эксплуатационные условия</h2>
      <div class="constants">
        <div>
          <h3>Гарантия</h3>
          <p>${escapeHtml(constants.warranty)}</p>
        </div>
        <div>
          <h3>Хранение и транспортировка</h3>
          <p>${escapeHtml(constants.storage)}</p>
        </div>
      </div>
    </section>
  </body>
</html>`;
}

export class ProductPassportPdfService {
  private async getConstants(): Promise<PassportConstants> {
    const defaults = {
      warranty: 'Гарантия на изделие составляет 12 месяцев с даты ввода в эксплуатацию.',
      storage: 'Изделие хранить в сухом помещении, исключить длительное воздействие влаги и агрессивной среды.'
    };
    const defaultByKey = new Map(DEFAULT_SETTINGS.map((item) => [item.key, item.value]));
    const settings = await Setting.find({ key: { $in: ['passport_warranty_text', 'passport_storage_text'] } }).lean();
    const byKey = new Map(settings.map((item) => [item.key, item.value]));
    return {
      warranty: String(byKey.get('passport_warranty_text') ?? defaultByKey.get('passport_warranty_text') ?? defaults.warranty),
      storage: String(byKey.get('passport_storage_text') ?? defaultByKey.get('passport_storage_text') ?? defaults.storage)
    };
  }

  async generateByProductId(productId: string): Promise<{ pdf: Buffer; filename: string }> {
    const product = await Product.findById(productId).lean();
    if (!product) throw new Error('Товар не найден');
    const spec = await ProductSpec.findOne({ productId }).lean();
    if (!spec) throw new Error('Технический профиль не найден');
    const constants = await this.getConstants();

    // Кеширование паспорта
    const productUpdatedAt = product.updatedAt ? new Date(product.updatedAt).getTime() : 0;
    const specUpdatedAt = spec.updatedAt ? new Date(spec.updatedAt).getTime() : 0;
    const latestUpdate = Math.max(productUpdatedAt, specUpdatedAt);
    
    const cachePath = pdfCacheService.getCachePath(productId, latestUpdate, 'passport');
    const cached = await pdfCacheService.get(cachePath);
    if (cached) {
      return { pdf: cached, filename: `passport-${String(product.code ?? product._id).replace(/[^\w.-]+/g, '_')}.pdf` };
    }

    const browser = await puppeteerService.getBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(renderPassportHtml({ product, spec, constants }), { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), { timeout: 10000 });
      
      const title = escapeHtml(`${product.name} — Технический паспорт`);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:8px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:0.1em;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f6;padding-bottom:4px;">
              <span>${title}</span>
              <span>Арт: ${escapeHtml(product.code || '—')}</span>
            </div>
          </div>
        `,
        footerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:9px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;border-top:1px solid #f3f4f6;padding-top:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;gap:15px;">
                <span>📧 info@invsportin.ru</span>
                <span>📞 +7 (495) 123-45-67</span>
              </div>
              <div style="color:#9ca3af;">
                Стр. <span class="pageNumber"></span> из <span class="totalPages"></span>
              </div>
            </div>
          </div>
        `,
        margin: {
          top: '18mm',
          right: '10mm',
          bottom: '16mm',
          left: '10mm'
        }
      });
      const buffer = Buffer.from(pdf);
      await pdfCacheService.set(cachePath, buffer);
      
      const safeCode = String(product.code ?? product._id).replace(/[^\w.-]+/g, '_');
      return { pdf: buffer, filename: `passport-${safeCode}.pdf` };
    } finally {
      // @ts-ignore
      if (typeof page !== 'undefined') await page.close();
    }
  }
}

export const productPassportPdfService = new ProductPassportPdfService();

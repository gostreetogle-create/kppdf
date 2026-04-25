import { puppeteerService } from './puppeteer.service';
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
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; color: #111827; }
      .page { min-height: calc(297mm - 24mm); page-break-after: always; break-after: page; display: flex; flex-direction: column; }
      .page:last-child { page-break-after: auto; break-after: auto; }
      .title { margin-top: 30mm; text-align: center; }
      .title h1 { font-size: 30px; margin: 0 0 10px; letter-spacing: 0.02em; }
      .title h2 { font-size: 18px; margin: 0; color: #4b5563; font-weight: 500; }
      .sheet-meta { margin-top: 28mm; border-top: 1px solid #e5e7eb; padding-top: 12mm; display: grid; gap: 8px; max-width: 120mm; }
      .meta-row { display: flex; justify-content: space-between; font-size: 14px; }
      .meta-row strong { font-weight: 600; }
      .section-title { margin: 0 0 8mm; font-size: 22px; }
      .spec-section { margin-bottom: 8mm; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
      .spec-section h3 { margin: 0; padding: 8px 12px; font-size: 14px; background: #f3f4f6; color: #374151; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      td { padding: 7px 12px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      td:first-child { width: 46%; color: #374151; }
      td:last-child { font-weight: 500; }
      .drawings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
      .drawing-card { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; min-height: 70mm; display: flex; flex-direction: column; }
      .drawing-card h3 { margin: 0; padding: 8px 10px; font-size: 13px; background: #f9fafb; color: #374151; }
      .drawing-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 8px; }
      .drawing-body img { width: 100%; max-height: 60mm; object-fit: contain; }
      .drawing-empty { font-size: 12px; color: #9ca3af; }
      .constants { margin-top: auto; border-top: 1px solid #e5e7eb; padding-top: 10mm; display: grid; gap: 6mm; }
      .constants h3 { margin: 0 0 2mm; font-size: 14px; }
      .constants p { margin: 0; font-size: 12px; line-height: 1.5; color: #374151; }
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

    const browser = await puppeteerService.getBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(renderPassportHtml({ product, spec, constants }), { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), { timeout: 10000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
      });
      const safeCode = String(product.code ?? product._id).replace(/[^\w.-]+/g, '_');
      return { pdf: Buffer.from(pdf), filename: `passport-${safeCode}.pdf` };
    } finally {
      // @ts-ignore
      if (typeof page !== 'undefined') await page.close();
    }
  }
}

export const productPassportPdfService = new ProductPassportPdfService();

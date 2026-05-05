import { puppeteerService } from './puppeteer.service';
import { pdfCacheService } from './pdf-cache.service';
import { calculateItemUnitPrice } from '../../../shared/utils/price.utils';

const MAX_PDF_RETRIES = 3;
const PDF_ASSET_BASE_URL = process.env['PDF_ASSET_BASE_URL'] || 'http://localhost:3000';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function formatDate(value?: Date | string): string {
  if (!value) return new Intl.DateTimeFormat('ru-RU').format(new Date());
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('ru-RU').format(new Date())
    : new Intl.DateTimeFormat('ru-RU').format(date);
}

function normalizeAssetUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = PDF_ASSET_BASE_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function renderKpHtml(kp: any): string {
  const items = Array.isArray(kp?.items) ? kp.items : [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item?.qty) || 0) * calculateItemUnitPrice(item), 0);
  const vatPercent = Number(kp?.vatPercent ?? 20);
  const vatAmount = Math.round(subtotal * vatPercent / (100 + vatPercent));
  const conditions = Array.isArray(kp?.conditions) ? kp.conditions : [];

  const photoScale = Number(kp?.metadata?.photoScalePercent ?? 600);
  const photoCrop = Number(kp?.metadata?.photoCropPercent ?? 0);
  
  // Расчет размеров в мм
  const MIN_SIZE = 6;
  const MAX_SIZE = 30;
  const normalized = Math.max(0, Math.min(1, photoScale / 1000));
  const photoSizeMm = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * normalized;
  const croppedHeightMm = photoSizeMm * (1 - (photoCrop * 2 / 100));

  const rows = items.map((item: any, index: number) => {
    const qty = Number(item?.qty) || 0;
    const price = calculateItemUnitPrice(item);
    const total = qty * price;
    const imageUrl = normalizeAssetUrl((item?.imageUrl || '').trim());
    const photoHtml = imageUrl 
      ? `<td class="col-photo">
          <div class="thumb-container" style="width: ${photoSizeMm}mm; height: ${croppedHeightMm}mm;">
            <img src="${escapeHtml(imageUrl)}" class="thumb" style="width: ${photoSizeMm}mm; height: ${photoSizeMm}mm;" alt="">
          </div>
         </td>`
      : `<td class="col-photo"></td>`;

    return `
      <tr>
        <td class="col-idx">${index + 1}</td>
        <td class="col-code">${escapeHtml(item?.code || '')}</td>
        ${photoHtml}
        <td class="col-name">${escapeHtml(item?.name || '')}</td>
        <td class="col-descr">${escapeHtml(item?.description || '')}</td>
        <td class="col-unit">${escapeHtml(item?.unit || 'шт')}</td>
        <td class="num col-qty">${qty}</td>
        <td class="num col-price">${formatMoney(price)}</td>
        <td class="num col-total">${formatMoney(total)}</td>
      </tr>
    `;
  }).join('');

  const conditionsHtml = conditions.length
    ? `
      <section class="conditions">
        <h3>Условия</h3>
        ${conditions.map((condition: string) => `<p>${escapeHtml(condition)}</p>`).join('')}
      </section>
    `
    : '';

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(kp?.metadata?.number || 'Коммерческое предложение')}</title>
    <style>
      @page { 
        size: A4; 
        margin: 18mm 10mm 16mm 10mm; 
      }
      * { box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
        margin: 0; 
        color: #1f2937; 
        line-height: 1.5;
      }
      .page { width: 100%; }
      .header { margin-bottom: 8mm; }
      .meta { font-size: 11px; color: #6b7280; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.025em; }
      h1 { font-size: 24px; margin: 0 0 2px; color: #111827; font-weight: 800; }
      h2 { font-size: 16px; margin: 0 0 12px; color: #4b5563; font-weight: 500; }
      table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 9px; table-layout: fixed; }
      th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: middle; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.2; }
      th { text-align: left; background: #f3f4f6; color: #111827; font-weight: 700; text-transform: uppercase; font-size: 8px; vertical-align: middle; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      .col-idx { width: 7mm; text-align: center; font-size: 8px; color: #6b7280; }
      .col-photo { width: 32mm; text-align: center; padding: 1mm; }
       .thumb-container { overflow: hidden; display: flex; align-items: center; justify-content: center; margin: 0 auto; border-radius: 1mm; }
       .thumb { object-fit: cover; display: block; margin: 0 auto; }
       .col-code { width: 18mm; color: #4b5563; font-size: 8px; }
       .col-name { width: auto; font-weight: 600; color: #111827; }
       .col-descr { width: 40mm; font-size: 8px; color: #4b5563; white-space: pre-wrap; }
       .col-unit { width: 10mm; text-align: center; }
       .col-qty { width: 12mm; }
       .col-price { width: 22mm; }
       .col-total { width: 25mm; }
      .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
      .totals { margin-top: 2mm; margin-left: auto; width: 90mm; font-size: 10px; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2mm 4mm; }
      .totals-row { display: flex; justify-content: space-between; padding: 2px 0; }
      .totals-row:last-child { font-weight: 700; border-top: 1px solid #e5e7eb; padding-top: 4px; margin-top: 2px; font-size: 14px; color: #111827; }
      .conditions { margin-top: 10mm; font-size: 11px; color: #4b5563; border-top: 1px solid #f3f4f6; padding-top: 6mm; }
      .conditions h3 { margin: 0 0 3mm; font-size: 13px; color: #111827; text-transform: uppercase; letter-spacing: 0.05em; }
      .conditions p { margin: 0 0 1.5mm; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="page">
      <header class="header">
        <p class="meta">Дата: ${escapeHtml(formatDate(kp?.metadata?.createdAt))}</p>
        <h1>${escapeHtml(kp?.title || 'Коммерческое предложение')}</h1>
        <h2>№ ${escapeHtml(kp?.metadata?.number || '')}</h2>
        <p class="meta">Получатель: ${escapeHtml(kp?.recipient?.name || '—')}</p>
      </header>
      <table>
        <thead>
          <tr>
            <th class="col-idx">#</th>
            <th class="col-code">Артикул</th>
            <th class="col-photo">Фото</th>
            <th class="col-name">Наименование</th>
            <th class="col-descr">Описание</th>
            <th class="col-unit">Ед.</th>
            <th class="num col-qty">Кол-во</th>
            <th class="num col-price">Цена</th>
            <th class="num col-total">Сумма</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="totals">
        <div class="totals-row"><span>Итого:</span><strong>${formatMoney(subtotal)}</strong></div>
        <div class="totals-row"><span>В том числе НДС ${vatPercent}%:</span><span>${formatMoney(vatAmount)}</span></div>
        <div class="totals-row"><span>Всего к оплате:</span><strong>${formatMoney(subtotal)}</strong></div>
      </section>
      ${conditionsHtml}
    </div>
  </body>
</html>`;
}

export class KpPdfService {
  async generatePdf(kp: any): Promise<Buffer> {
    const kpId = String(kp?._id || '');
    const updatedAt = kp?.updatedAt || kp?.metadata?.createdAt || new Date();
    const cachePath = kpId ? pdfCacheService.getCachePath(kpId, updatedAt, 'kp') : null;

    if (cachePath) {
      const cached = await pdfCacheService.get(cachePath);
      if (cached) return cached;
    }

    let lastError: any;
    for (let attempt = 1; attempt <= MAX_PDF_RETRIES; attempt++) {
      try {
        return await this.performGenerate(kp, cachePath);
      } catch (err) {
        lastError = err;
        console.error(`PDF Generation attempt ${attempt} failed:`, err);
        if (attempt < MAX_PDF_RETRIES) {
          // Ждем немного перед повторной попыткой
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }
    throw new Error(`Failed to generate PDF after ${MAX_PDF_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async performGenerate(kp: any, cachePath: string | null): Promise<Buffer> {
    const browser = await puppeteerService.getBrowser();
    let page: any;
    try {
      page = await browser.newPage();
      
      // Устанавливаем таймаут для всех операций на странице
      page.setDefaultNavigationTimeout(30000);
      page.setDefaultTimeout(30000);

      await page.setContent(renderKpHtml(kp), { 
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 30000 
      });

      // Дополнительное ожидание для уверенности, что изображения загружены
      await page.evaluate(async () => {
        const selectors = Array.from(document.querySelectorAll('img'));
        await Promise.all(selectors.map(img => {
          if (img.complete) return;
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // Не блокируем генерацию, если картинка не загрузилась
            setTimeout(resolve, 5000); // Fail-safe таймаут для каждой картинки
          });
        }));
      });

      const title = escapeHtml(kp?.title || 'Коммерческое предложение');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:8px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-transform:uppercase;letter-spacing:0.1em;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f6;padding-bottom:4px;">
              <span>${title}</span>
              <span>№ ${escapeHtml(kp?.metadata?.number || '—')}</span>
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
      if (cachePath) {
        await pdfCacheService.set(cachePath, buffer);
      }
      return buffer;
    } finally {
      if (page) await page.close();
    }
  }
}

export const kpPdfService = new KpPdfService();

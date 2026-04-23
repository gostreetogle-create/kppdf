import puppeteer from 'puppeteer';

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

function renderKpHtml(kp: any): string {
  const items = Array.isArray(kp?.items) ? kp.items : [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item?.qty) || 0) * (Number(item?.price) || 0), 0);
  const vatPercent = Number(kp?.vatPercent ?? 20);
  const vatAmount = Math.round(subtotal * vatPercent / (100 + vatPercent));
  const conditions = Array.isArray(kp?.conditions) ? kp.conditions : [];

  const rows = items.map((item: any, index: number) => {
    const qty = Number(item?.qty) || 0;
    const price = Number(item?.price) || 0;
    const total = qty * price;
    return `
      <tr class="kp-row">
        <td>${index + 1}</td>
        <td>${escapeHtml(item?.code || '')}</td>
        <td>${escapeHtml(item?.name || '')}</td>
        <td>${escapeHtml(item?.unit || 'шт')}</td>
        <td class="num">${qty}</td>
        <td class="num">${formatMoney(price)}</td>
        <td class="num">${formatMoney(total)}</td>
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
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #111827; }
      .page { width: 100%; }
      .header { margin-bottom: 10mm; }
      .meta { font-size: 12px; color: #4b5563; margin: 0 0 6px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6mm; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
      th { text-align: left; background: #f3f4f6; }
      .kp-row { page-break-inside: avoid; break-inside: avoid; }
      .num { text-align: right; white-space: nowrap; }
      .totals { margin-top: 6mm; margin-left: auto; width: 80mm; font-size: 12px; }
      .totals-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #e5e7eb; }
      .totals-row:last-child { font-weight: 700; border-bottom: 0; padding-top: 6px; }
      .conditions { margin-top: 8mm; font-size: 12px; }
      .conditions h3 { margin: 0 0 3mm; font-size: 14px; }
      .conditions p { margin: 0 0 2mm; }
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
            <th>#</th>
            <th>Артикул</th>
            <th>Наименование</th>
            <th>Ед.</th>
            <th class="num">Кол-во</th>
            <th class="num">Цена</th>
            <th class="num">Сумма</th>
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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      await page.setContent(renderKpHtml(kp), { waitUntil: 'networkidle0' });
      const title = escapeHtml(kp?.title || 'Коммерческое предложение');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:9px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:3px;">
              <span>${title}</span>
              <span class="date"></span>
            </div>
          </div>
        `,
        footerTemplate: `
          <div style="width:100%;padding:0 10mm;font-size:9px;color:#6b7280;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center;">
            Страница <span class="pageNumber"></span> из <span class="totalPages"></span>
          </div>
        `,
        margin: {
          top: '18mm',
          right: '10mm',
          bottom: '16mm',
          left: '10mm'
        }
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

export const kpPdfService = new KpPdfService();

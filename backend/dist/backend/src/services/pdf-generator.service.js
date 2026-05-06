"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfGeneratorService = exports.PdfGeneratorService = void 0;
const puppeteer_service_1 = require("./puppeteer.service");
const pdf_cache_service_1 = require("./pdf-cache.service");
const kp_model_1 = require("../models/kp.model");
class PdfGeneratorService {
    getFrontendBaseUrl() {
        return process.env.FRONTEND_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:4200';
    }
    getPdfAssetBaseUrl() {
        const raw = process.env.PDF_ASSET_BASE_URL?.trim();
        if (!raw)
            return null;
        return raw.replace(/\/$/, '');
    }
    async generateKpPdf(input) {
        // В версии КП (versions[*]) могут лежать items — явно запрашиваем, чтобы не получить ожидаемо пустой expectedItems.
        const kp = await kp_model_1.Kp
            .findById(input.kpId)
            // Важно: не проецируем одновременно parent-объект `versions` и его подпуть `versions.items`,
            // иначе Mongo даёт `Path collision at versions.items ...`.
            .select('updatedAt metadata.createdAt items versions.version versions.createdAt versions.items')
            .lean();
        const resolvedVersion = typeof input.version === 'number' && Number.isFinite(input.version)
            ? input.version
            : undefined;
        const versionEntry = resolvedVersion && Array.isArray(kp?.versions)
            ? kp.versions.find((v) => Number(v?.version) === resolvedVersion)
            : null;
        if (resolvedVersion && !versionEntry) {
            throw new Error('Версия КП не найдена');
        }
        const topItemsCount = (kp?.items?.length ?? 0);
        const versionItemsCount = (resolvedVersion && versionEntry?.items && Array.isArray(versionEntry.items))
            ? versionEntry.items.length
            : null;
        const expectedItems = resolvedVersion ? (versionItemsCount ?? topItemsCount) : topItemsCount;
        const updatedAt = versionEntry?.createdAt
            || kp?.updatedAt
            || kp?.metadata?.createdAt
            || new Date();
        const cacheKey = resolvedVersion ? `kp-full-v${resolvedVersion}` : 'kp-full';
        const cachePath = pdf_cache_service_1.pdfCacheService.getCachePath(input.kpId, updatedAt, cacheKey);
        const cached = await pdf_cache_service_1.pdfCacheService.get(cachePath);
        if (cached)
            return cached;
        const browser = await puppeteer_service_1.puppeteerService.getBrowser();
        const page = await browser.newPage();
        try {
            page.on('console', (msg) => {
                // eslint-disable-next-line no-console
                console.log(`[PDF Puppeteer console][${msg.type()}] ${msg.text()}`);
            });
            page.on('pageerror', (err) => {
                // eslint-disable-next-line no-console
                console.error('[PDF Puppeteer pageerror]', err);
            });
            await page.setViewport({ width: 1440, height: 2000, deviceScaleFactor: 2 });
            if (input.accessToken) {
                await page.evaluateOnNewDocument((token) => {
                    window.localStorage.setItem('kp_access_token', token);
                    window.localStorage.removeItem('kp_refresh_token');
                }, input.accessToken);
            }
            const versionParam = resolvedVersion ? `&version=${encodeURIComponent(String(resolvedVersion))}` : '';
            const expectedItemsParam = `&expectedItems=${encodeURIComponent(String(expectedItems))}`;
            const targetUrl = `${this.getFrontendBaseUrl().replace(/\/$/, '')}/kp/${encodeURIComponent(input.kpId)}?pdf=1${expectedItemsParam}${versionParam}`;
            await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            // Wait until Angular renders document preview.
            await page.waitForSelector('app-kp-document', { timeout: 30000 });
            await page.waitForFunction(() => document.querySelectorAll('app-kp-document').length > 0, { timeout: 30000 });
            const preDiagnostics = await page.evaluate(() => {
                const marker = globalThis.__KP_PDF_READY__;
                const domRows = document.querySelectorAll('table.kp-table tbody tr.kp-row').length;
                const htmlItemsCount = document.documentElement.getAttribute('data-kp-items-count');
                return { markerItemsCount: marker?.itemsCount ?? null, domRows, htmlItemsCount };
            });
            console.log(`[PDF pre] KP ${input.kpId}: expectedItems=${expectedItems}, markerItemsCount=${preDiagnostics.markerItemsCount}, htmlItemsCount=${preDiagnostics.htmlItemsCount}, domRows=${preDiagnostics.domRows}`);
            // Wait until KP builder reports that items are rendered.
            // This prevents generating a PDF before async KP loading finishes (which results in empty tables).
            await page.waitForFunction((itemsCount) => {
                const marker = globalThis.__KP_PDF_READY__;
                if (!marker || typeof marker.itemsCount !== 'number')
                    return false;
                if (itemsCount > 0)
                    return marker.itemsCount === itemsCount;
                // If backend couldn't determine expectedItems (0), accept any rendered count.
                return marker.itemsCount >= 0;
            }, { timeout: 30000 }, expectedItems);
            const diagnostics = await page.evaluate(() => {
                const marker = globalThis.__KP_PDF_READY__;
                const domRows = document.querySelectorAll('table.kp-table tbody tr.kp-row').length;
                const firstRow = document.querySelector('table.kp-table tbody tr.kp-row');
                const firstRowCells = firstRow
                    ? Array.from(firstRow.querySelectorAll('td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim())
                    : [];
                const nameCell = firstRow?.querySelector('.kp-cell-name');
                const nameCellStyles = nameCell ? getComputedStyle(nameCell) : null;
                return {
                    markerItemsCount: marker?.itemsCount ?? null,
                    htmlItemsCount: document.documentElement.getAttribute('data-kp-items-count'),
                    domRows,
                    firstRowCells,
                    nameCellColor: nameCellStyles?.color ?? null,
                    nameCellVisibility: nameCellStyles?.visibility ?? null,
                    nameCellDisplay: nameCellStyles?.display ?? null,
                    nameCellOpacity: nameCellStyles?.opacity ?? null,
                };
            });
            console.log(`[PDF] KP ${input.kpId}: expectedItems=${expectedItems}, markerItemsCount=${diagnostics.markerItemsCount}, htmlItemsCount=${diagnostics.htmlItemsCount}, domRows=${diagnostics.domRows}, firstRowCells=${JSON.stringify(diagnostics.firstRowCells)}, nameCellColor=${diagnostics.nameCellColor}, nameCellVisibility=${diagnostics.nameCellVisibility}, nameCellDisplay=${diagnostics.nameCellDisplay}, nameCellOpacity=${diagnostics.nameCellOpacity}`);
            if (expectedItems > 0 && diagnostics.domRows === 0) {
                // Let retry kick in: we don't want to output a blank table.
                throw new Error(`KP PDF DOM diagnostics: expectedItems=${expectedItems} but domRows=0`);
            }
            const assetBaseUrl = this.getPdfAssetBaseUrl();
            if (assetBaseUrl) {
                await page.evaluate((baseUrl) => {
                    document.querySelectorAll('img[src]').forEach((img) => {
                        const src = img.getAttribute('src');
                        if (!src || !src.startsWith('/'))
                            return;
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
            // Ensure images are settled before generating PDF.
            // Some images may be optional/broken; we only wait for completion to avoid blocking export.
            await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), { timeout: 30000 });
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
            await pdf_cache_service_1.pdfCacheService.set(cachePath, buffer);
            return buffer;
        }
        finally {
            await page.close();
        }
    }
}
exports.PdfGeneratorService = PdfGeneratorService;
exports.pdfGeneratorService = new PdfGeneratorService();

/**
 * Нормализация URL изображений товаров.
 *
 * В базе URL могут храниться в разных форматах:
 *   - "products/file.png"       -> /media/products/file.png
 *   - "/media/products/file.png" -> /media/products/file.png
 *   - "https://..."              -> как есть
 *   - пустое/null               -> fallback-заглушка
 *
 * Заглушка лежит в frontend/public/kp-1str.png (без /media/).
 */

const FALLBACK_IMAGE = '/kp-1str.png';

export function normalizeImageUrl(
  images: { url?: string | null; isMain?: boolean }[] | undefined | null,
): string {
  if (!images?.length) return FALLBACK_IMAGE;

  const raw = (images.find((i) => i.isMain) ?? images[0])?.url?.trim();
  if (!raw) return FALLBACK_IMAGE;

  // Абсолютные URL (CDN, data URI, blob) — отдаём как есть
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

  // Убираем ведущие ./ или /
  const normalized = raw.replace(/\\/g, '/').replace(/^\.?\//, '');

  // media/products/file.png -> /media/products/file.png
  if (normalized.startsWith('media/')) return '/' + normalized;

  // products/file.png -> /media/products/file.png
  if (normalized.startsWith('products/')) return '/media/' + normalized;

  // Если уже начинается с / — отдаём как есть
  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

type TrimMode = 'alpha' | 'white-bg' | 'none';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function isNearWhite(rgb: number[], threshold: number): boolean {
  return rgb.length >= 3 && rgb[0] >= threshold && rgb[1] >= threshold && rgb[2] >= threshold;
}

async function detectTrimMode(filePath: string, whiteThreshold: number): Promise<TrimMode> {
  const image = sharp(filePath, { failOn: 'none' });
  const metadata = await image.metadata();
  if (metadata.hasAlpha) return 'alpha';

  const channels = metadata.channels ?? 0;
  if (channels < 3) return 'none';
  if (!metadata.width || !metadata.height) return 'none';

  const pixel = await image
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();
  const rgb = Array.from(pixel.slice(0, 3));
  return isNearWhite(rgb, whiteThreshold) ? 'white-bg' : 'none';
}

export async function trimProductImagePadding(filePath: string): Promise<{ applied: boolean; mode: TrimMode }> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return { applied: false, mode: 'none' };
  if (!fs.existsSync(filePath)) return { applied: false, mode: 'none' };

  const mode = await detectTrimMode(filePath, 245);
  if (mode === 'none') return { applied: false, mode };

  const trimThreshold = mode === 'alpha' ? 1 : 10;
  const tempPath = `${filePath}.trimmed${ext}`;
  const pipeline = sharp(filePath, { failOn: 'none' }).rotate().trim({ threshold: trimThreshold });
  await pipeline.toFile(tempPath);

  try {
    const originalMeta = await sharp(filePath, { failOn: 'none' }).metadata();
    const trimmedMeta = await sharp(tempPath, { failOn: 'none' }).metadata();
    const originalArea = (originalMeta.width ?? 0) * (originalMeta.height ?? 0);
    const trimmedArea = (trimmedMeta.width ?? 0) * (trimmedMeta.height ?? 0);
    if (!trimmedArea || !originalArea || trimmedArea >= originalArea) {
      await fs.promises.unlink(tempPath);
      return { applied: false, mode: 'none' };
    }

    await fs.promises.unlink(filePath);
    await fs.promises.rename(tempPath, filePath);
    return { applied: true, mode };
  } catch {
    if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
    return { applied: false, mode: 'none' };
  }
}

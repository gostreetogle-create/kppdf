import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { trimProductImagePadding } from '../utils/image-trim.util';

dotenv.config();

const mediaRoot = process.env.MEDIA_ROOT || path.resolve(process.cwd(), '..', 'media');
const productsMediaDir = path.join(mediaRoot, 'products');
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function main(): Promise<void> {
  if (!fs.existsSync(productsMediaDir)) {
    console.log(`[trim-product-images] directory not found: ${productsMediaDir}`);
    return;
  }

  const entries = await fs.promises.readdir(productsMediaDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => path.join(productsMediaDir, entry.name))
    .filter(filePath => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  let processed = 0;
  let trimmed = 0;
  let failed = 0;

  for (const filePath of files) {
    processed += 1;
    try {
      const result = await trimProductImagePadding(filePath);
      if (result.applied) trimmed += 1;
    } catch (error) {
      failed += 1;
      console.warn('[trim-product-images] failed:', path.basename(filePath), error);
    }
  }

  console.log(`[trim-product-images] processed=${processed}, trimmed=${trimmed}, failed=${failed}`);
}

main().catch((error) => {
  console.error('[trim-product-images] fatal error:', error);
  process.exit(1);
});

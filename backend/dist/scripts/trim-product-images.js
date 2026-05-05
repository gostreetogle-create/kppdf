"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const image_trim_util_1 = require("../utils/image-trim.util");
dotenv_1.default.config();
const mediaRoot = process.env.MEDIA_ROOT || path_1.default.resolve(process.cwd(), '..', 'media');
const productsMediaDir = path_1.default.join(mediaRoot, 'products');
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
async function main() {
    if (!fs_1.default.existsSync(productsMediaDir)) {
        console.log(`[trim-product-images] directory not found: ${productsMediaDir}`);
        return;
    }
    const entries = await fs_1.default.promises.readdir(productsMediaDir, { withFileTypes: true });
    const files = entries
        .filter(entry => entry.isFile())
        .map(entry => path_1.default.join(productsMediaDir, entry.name))
        .filter(filePath => SUPPORTED_EXTENSIONS.has(path_1.default.extname(filePath).toLowerCase()));
    let processed = 0;
    let trimmed = 0;
    let failed = 0;
    for (const filePath of files) {
        processed += 1;
        try {
            const result = await (0, image_trim_util_1.trimProductImagePadding)(filePath);
            if (result.applied)
                trimmed += 1;
        }
        catch (error) {
            failed += 1;
            console.warn('[trim-product-images] failed:', path_1.default.basename(filePath), error);
        }
    }
    console.log(`[trim-product-images] processed=${processed}, trimmed=${trimmed}, failed=${failed}`);
}
main().catch((error) => {
    console.error('[trim-product-images] fatal error:', error);
    process.exit(1);
});

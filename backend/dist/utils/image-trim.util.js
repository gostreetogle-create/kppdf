"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimProductImagePadding = trimProductImagePadding;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
function isNearWhite(rgb, threshold) {
    return rgb.length >= 3 && rgb[0] >= threshold && rgb[1] >= threshold && rgb[2] >= threshold;
}
async function detectTrimMode(filePath, whiteThreshold) {
    const image = (0, sharp_1.default)(filePath, { failOn: 'none' });
    const metadata = await image.metadata();
    if (metadata.hasAlpha)
        return 'alpha';
    const channels = metadata.channels ?? 0;
    if (channels < 3)
        return 'none';
    if (!metadata.width || !metadata.height)
        return 'none';
    const pixel = await image
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .raw()
        .toBuffer();
    const rgb = Array.from(pixel.slice(0, 3));
    return isNearWhite(rgb, whiteThreshold) ? 'white-bg' : 'none';
}
async function trimProductImagePadding(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext))
        return { applied: false, mode: 'none' };
    if (!fs_1.default.existsSync(filePath))
        return { applied: false, mode: 'none' };
    const mode = await detectTrimMode(filePath, 245);
    if (mode === 'none')
        return { applied: false, mode };
    const trimThreshold = mode === 'alpha' ? 1 : 10;
    const tempPath = `${filePath}.trimmed${ext}`;
    const pipeline = (0, sharp_1.default)(filePath, { failOn: 'none' }).rotate().trim({ threshold: trimThreshold });
    await pipeline.toFile(tempPath);
    try {
        const originalMeta = await (0, sharp_1.default)(filePath, { failOn: 'none' }).metadata();
        const trimmedMeta = await (0, sharp_1.default)(tempPath, { failOn: 'none' }).metadata();
        const originalArea = (originalMeta.width ?? 0) * (originalMeta.height ?? 0);
        const trimmedArea = (trimmedMeta.width ?? 0) * (trimmedMeta.height ?? 0);
        if (!trimmedArea || !originalArea || trimmedArea >= originalArea) {
            await fs_1.default.promises.unlink(tempPath);
            return { applied: false, mode: 'none' };
        }
        await fs_1.default.promises.unlink(filePath);
        await fs_1.default.promises.rename(tempPath, filePath);
        return { applied: true, mode };
    }
    catch {
        if (fs_1.default.existsSync(tempPath))
            await fs_1.default.promises.unlink(tempPath);
        return { applied: false, mode: 'none' };
    }
}

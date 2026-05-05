"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfCacheService = exports.PdfCacheService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
class PdfCacheService {
    constructor() {
        this.cacheDir = path_1.default.resolve(process.cwd(), 'temp', 'storage');
        this.ensureDir();
    }
    async ensureDir() {
        try {
            await promises_1.default.mkdir(this.cacheDir, { recursive: true });
        }
        catch (err) {
            // ignore
        }
    }
    /**
     * Генерирует путь к кешированному файлу на основе ID сущности и даты её последнего обновления.
     * Если дата меняется, путь будет другим, что автоматически инвалидирует кеш.
     */
    getCachePath(entityId, updatedAt, prefix = 'kp') {
        const timestamp = new Date(updatedAt).getTime();
        const hash = crypto_1.default.createHash('md5').update(`${entityId}_${timestamp}`).digest('hex');
        return path_1.default.join(this.cacheDir, `${prefix}_${entityId}_${hash}.pdf`);
    }
    /**
     * Пытается прочитать файл из кеша.
     */
    async get(cachePath) {
        try {
            return await promises_1.default.readFile(cachePath);
        }
        catch {
            return null;
        }
    }
    /**
     * Сохраняет Buffer в кеш.
     */
    async set(cachePath, buffer) {
        try {
            await this.ensureDir();
            await promises_1.default.writeFile(cachePath, buffer);
            // Опционально: можно добавить очистку старых версий этого же entityId
            this.cleanupOldVersions(cachePath);
        }
        catch (err) {
            console.error('Ошибка при записи PDF в кеш:', err);
        }
    }
    /**
     * Удаляет старые версии кеша для той же сущности, чтобы не забивать диск.
     */
    async cleanupOldVersions(currentCachePath) {
        try {
            const fileName = path_1.default.basename(currentCachePath);
            const parts = fileName.split('_');
            if (parts.length < 3)
                return;
            const prefix = parts[0];
            const entityId = parts[1];
            const files = await promises_1.default.readdir(this.cacheDir);
            for (const file of files) {
                if (file.startsWith(`${prefix}_${entityId}_`) && file !== fileName) {
                    await promises_1.default.unlink(path_1.default.join(this.cacheDir, file)).catch(() => { });
                }
            }
        }
        catch (err) {
            // ignore cleanup errors
        }
    }
}
exports.PdfCacheService = PdfCacheService;
exports.pdfCacheService = new PdfCacheService();

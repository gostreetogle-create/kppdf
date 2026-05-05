"use strict";
/**
 * Seed-скрипт: массовый импорт товаров из JSON-файла.
 *
 * Использование:
 *   npx ts-node-dev --respawn src/scripts/seed-products.ts
 *   npx ts-node-dev --respawn src/scripts/seed-products.ts --mode=update
 *   npx ts-node-dev --respawn src/scripts/seed-products.ts --file=./my-products.json
 *
 * Флаги:
 *   --mode=skip    (default) — пропустить товар если артикул уже существует
 *   --mode=update  — обновить существующий товар по артикулу
 *   --file=<path>  — путь к JSON-файлу (default: bulk-trade-goods-data.json рядом со скриптом)
 *
 * Формат JSON-файла:
 *   { "items": [ { "code", "name", "unit"/"unitCode", "price"/"priceRub", ... } ] }
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = require("fs");
const path_1 = require("path");
const product_model_1 = require("../models/product.model");
function getArgValue(name) {
    const token = process.argv.find(arg => arg.startsWith(`--${name}=`));
    return token?.slice(name.length + 3);
}
const scriptDir = (0, path_1.dirname)(__filename);
const defaultJsonPath = (0, path_1.resolve)(scriptDir, 'bulk-trade-goods-data.json');
const modeArg = getArgValue('mode');
const mode = modeArg === 'update' ? 'update' : 'skip';
const fileArg = getArgValue('file');
const jsonPath = fileArg ? (0, path_1.resolve)(fileArg) : defaultJsonPath;
if (!(0, fs_1.existsSync)(jsonPath)) {
    console.error(`❌ Файл не найден: ${jsonPath}`);
    console.error('   Укажите путь через --file=<path>');
    process.exit(1);
}
// ─── Загрузка данных ──────────────────────────────────────────────────────────
let items;
try {
    const raw = JSON.parse((0, fs_1.readFileSync)(jsonPath, 'utf-8'));
    items = Array.isArray(raw) ? raw : raw.items;
    if (!Array.isArray(items) || items.length === 0)
        throw new Error('items пуст или не является массивом');
}
catch (e) {
    console.error(`❌ Ошибка чтения JSON: ${e.message}`);
    process.exit(1);
}
// ─── Маппинг полей ────────────────────────────────────────────────────────────
function buildPayload(item) {
    return {
        code: String(item.code ?? '').trim(),
        name: String(item.name ?? '').trim(),
        description: String(item.description ?? '').trim(),
        category: String(item.category ?? '').trim(),
        subcategory: item.subcategory ? String(item.subcategory).trim() : undefined,
        unit: String(item.unit ?? item.unitCode ?? '').trim(),
        price: Number(item.price ?? item.priceRub ?? 0),
        costRub: item.costRub != null ? Number(item.costRub) : undefined,
        images: Array.isArray(item.images) ? item.images : [],
        isActive: item.isActive !== undefined ? Boolean(item.isActive) : true,
        kind: item.kind ?? 'ITEM',
        notes: item.notes ? String(item.notes).trim() : undefined,
    };
}
// ─── Основная логика ──────────────────────────────────────────────────────────
async function main() {
    const mongoUri = process.env.MONGODB_URI ?? process.env.MONGO_URI ?? 'mongodb://localhost:27017/kppdf';
    console.log(`🔌 Подключение к MongoDB: ${mongoUri}`);
    await mongoose_1.default.connect(mongoUri);
    console.log('✅ Подключено\n');
    console.log(`📦 Файл:  ${jsonPath}`);
    console.log(`📋 Режим: ${mode} (${mode === 'skip' ? 'пропускать дубли' : 'обновлять дубли'})`);
    console.log(`📊 Товаров в файле: ${items.length}\n`);
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const item of items) {
        const payload = buildPayload(item);
        if (!payload.code || !payload.name || !payload.unit || payload.price == null) {
            const msg = `Пропущен (нет обязательных полей): code="${payload.code}" name="${payload.name}"`;
            results.errors.push(msg);
            console.warn(`  ⚠️  ${msg}`);
            continue;
        }
        try {
            const existing = await product_model_1.Product.findOne({ code: payload.code });
            if (existing) {
                if (mode === 'update') {
                    await product_model_1.Product.findByIdAndUpdate(existing._id, payload, { runValidators: true });
                    results.updated++;
                    console.log(`  ✏️  Обновлён:  [${payload.code}] ${payload.name}`);
                }
                else {
                    results.skipped++;
                    console.log(`  ⏭️  Пропущен:  [${payload.code}] ${payload.name}`);
                }
            }
            else {
                await product_model_1.Product.create(payload);
                results.created++;
                console.log(`  ✅ Создан:    [${payload.code}] ${payload.name}`);
            }
        }
        catch (e) {
            const msg = `Ошибка для артикула "${payload.code}": ${e.message}`;
            results.errors.push(msg);
            console.error(`  ❌ ${msg}`);
        }
    }
    console.log('\n─────────────────────────────────────');
    console.log(`✅ Создано:   ${results.created}`);
    console.log(`✏️  Обновлено: ${results.updated}`);
    console.log(`⏭️  Пропущено: ${results.skipped}`);
    if (results.errors.length > 0) {
        console.log(`❌ Ошибок:    ${results.errors.length}`);
    }
    console.log('─────────────────────────────────────\n');
    await mongoose_1.default.disconnect();
    console.log('🔌 Отключено от MongoDB');
}
main().catch(e => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
});

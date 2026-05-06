"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampPercent = clampPercent;
exports.parsePercentInput = parsePercentInput;
exports.calculateEffectivePrice = calculateEffectivePrice;
exports.calculateItemUnitPrice = calculateItemUnitPrice;
exports.calculateKpTotals = calculateKpTotals;
/**
 * Ограничивает процентное значение в заданном диапазоне
 */
function clampPercent(value, min, max) {
    const n = (value !== null && value !== undefined && Number.isFinite(value)) ? value : 0;
    return Math.min(max, Math.max(min, n));
}
/**
 * Парсит процент из строки или числа
 */
function parsePercentInput(value) {
    if (typeof value === 'number')
        return value;
    if (!value || typeof value !== 'string' || !value.trim())
        return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
/**
 * Вычисляет эффективную цену за единицу товара с учетом наценки и скидки.
 * Является чистой функцией (pure function).
 * Формула: round(price * (1 + markup/100) * (1 - discount/100))
 */
function calculateEffectivePrice(basePrice, markupPercent = 0, discountPercent = 0, markupEnabled = true, discountEnabled = true) {
    const m = markupEnabled ? clampPercent(markupPercent, 0, 500) : 0;
    const d = discountEnabled ? clampPercent(discountPercent, 0, 100) : 0;
    const priceWithMarkup = basePrice * (1 + m / 100);
    const finalPrice = priceWithMarkup * (1 - d / 100);
    // Округляем до ближайшего целого (копейки в системе не используются для итоговых КП)
    return Math.max(0, Math.round(finalPrice));
}
/**
 * Вычисляет эффективную цену за единицу товара на основе объекта KpItem
 */
function calculateItemUnitPrice(item) {
    return calculateEffectivePrice(item.price, item.markupPercent, item.discountPercent, item.markupEnabled, item.discountEnabled);
}
/**
 * Вычисляет итоги КП на основе списка товаров и процента НДС.
 * НДС уже включен в subtotal.
 */
function calculateKpTotals(items, vatPercent) {
    const subtotal = items.reduce((sum, item) => {
        return sum + calculateItemUnitPrice(item) * item.qty;
    }, 0);
    const vatAmount = Math.round(subtotal * vatPercent / (100 + vatPercent));
    return {
        subtotal,
        vatAmount,
        vatPercent,
        total: subtotal
    };
}

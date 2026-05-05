"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clampPercent = clampPercent;
exports.parsePercentInput = parsePercentInput;
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
 * Вычисляет эффективную цену за единицу товара с учетом наценки и скидки
 * round(item.price × (1 + markup%/100) × (1 - discount%/100))
 */
function calculateItemUnitPrice(item) {
    const markupPercent = item.markupEnabled ? clampPercent(item.markupPercent, 0, 500) : 0;
    const discountPercent = item.discountEnabled ? clampPercent(item.discountPercent, 0, 100) : 0;
    const withMarkup = item.price * (1 + markupPercent / 100);
    const withDiscount = withMarkup * (1 - discountPercent / 100);
    return Math.max(0, Math.round(withDiscount));
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

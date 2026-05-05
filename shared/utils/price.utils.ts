import { KpItem } from '../types/Kp';

/**
 * Ограничивает процентное значение в заданном диапазоне
 */
export function clampPercent(value: number | null | undefined, min: number, max: number): number {
  const n = (value !== null && value !== undefined && Number.isFinite(value)) ? value : 0;
  return Math.min(max, Math.max(min, n));
}

/**
 * Парсит процент из строки или числа
 */
export function parsePercentInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string' || !value.trim()) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Вычисляет эффективную цену за единицу товара с учетом наценки и скидки.
 * Является чистой функцией (pure function).
 * Формула: round(price * (1 + markup/100) * (1 - discount/100))
 */
export function calculateEffectivePrice(
  basePrice: number,
  markupPercent: number = 0,
  discountPercent: number = 0,
  markupEnabled: boolean = true,
  discountEnabled: boolean = true
): number {
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
export function calculateItemUnitPrice(item: KpItem): number {
  return calculateEffectivePrice(
    item.price,
    item.markupPercent,
    item.discountPercent,
    item.markupEnabled,
    item.discountEnabled
  );
}

/**
 * Итоги КП
 */
export interface KpTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatPercent: number;
}

/**
 * Вычисляет итоги КП на основе списка товаров и процента НДС.
 * НДС уже включен в subtotal.
 */
export function calculateKpTotals(items: KpItem[], vatPercent: number): KpTotals {
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

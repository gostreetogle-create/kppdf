import { calculateEffectivePrice, calculateItemUnitPrice, calculateKpTotals, clampPercent, parsePercentInput } from '../../../../../shared/utils/price.utils';
import { KpItem } from '@shared/types/Kp';

describe('Price Utils', () => {
  describe('calculateEffectivePrice', () => {
    it('should handle zero markup and discount', () => {
      expect(calculateEffectivePrice(100, 0, 0)).toBe(100);
    });

    it('should handle 100% discount', () => {
      expect(calculateEffectivePrice(1000, 50, 100)).toBe(0);
    });

    it('should handle very small prices', () => {
      expect(calculateEffectivePrice(0.01, 10, 0)).toBe(0); // 0.011 -> 0
      expect(calculateEffectivePrice(0.6, 0, 0)).toBe(1); // 0.6 -> 1
    });

    it('should clamp markup to 500%', () => {
      expect(calculateEffectivePrice(100, 1000, 0)).toBe(600); // 100 + 500%
    });

    it('should apply markup then discount', () => {
      // (100 + 100%) - 50% = 200 - 50% = 100
      expect(calculateEffectivePrice(100, 100, 50)).toBe(100);
    });

    it('should round correctly (.5 up)', () => {
      // 100 - 12.5% = 87.5 -> 88
      expect(calculateEffectivePrice(100, 0, 12.5)).toBe(88);
      // 100 - 12.51% = 87.49 -> 87
      expect(calculateEffectivePrice(100, 0, 12.51)).toBe(87);
    });

    it('should handle disabled markup/discount', () => {
      expect(calculateEffectivePrice(100, 50, 50, false, false)).toBe(100);
      expect(calculateEffectivePrice(100, 50, 50, true, false)).toBe(150);
      expect(calculateEffectivePrice(100, 50, 50, false, true)).toBe(50);
    });
  });

  describe('clampPercent', () => {
    it('should clamp values within range', () => {
      expect(clampPercent(50, 0, 100)).toBe(50);
      expect(clampPercent(-10, 0, 100)).toBe(0);
      expect(clampPercent(150, 0, 100)).toBe(100);
    });

    it('should handle null/undefined/NaN', () => {
      expect(clampPercent(null, 0, 100)).toBe(0);
      expect(clampPercent(undefined, 0, 100)).toBe(0);
      expect(clampPercent(NaN, 0, 100)).toBe(0);
    });
  });

  describe('parsePercentInput', () => {
    it('should parse numbers', () => {
      expect(parsePercentInput(10)).toBe(10);
      expect(parsePercentInput(0)).toBe(0);
    });

    it('should parse strings', () => {
      expect(parsePercentInput('10')).toBe(10);
      expect(parsePercentInput('  25.5  ')).toBe(25.5);
      expect(parsePercentInput('')).toBe(0);
      expect(parsePercentInput('invalid')).toBe(0);
    });

    it('should handle null/undefined', () => {
      expect(parsePercentInput(null)).toBe(0);
      expect(parsePercentInput(undefined)).toBe(0);
    });
  });

  describe('calculateItemUnitPrice', () => {
    const baseItem: KpItem = {
      productId: '1',
      name: 'Test Product',
      description: '',
      unit: 'шт',
      price: 1000,
      qty: 1
    };

    it('should return base price when no markup/discount enabled', () => {
      expect(calculateItemUnitPrice(baseItem)).toBe(1000);
    });

    it('should apply markup correctly', () => {
      const item: KpItem = { ...baseItem, markupEnabled: true, markupPercent: 20 };
      expect(calculateItemUnitPrice(item)).toBe(1200);
    });

    it('should apply discount correctly', () => {
      const item: KpItem = { ...baseItem, discountEnabled: true, discountPercent: 10 };
      expect(calculateItemUnitPrice(item)).toBe(900);
    });

    it('should apply both markup and discount (markup first, then discount)', () => {
      // 1000 + 20% = 1200
      // 1200 - 10% = 1080
      const item: KpItem = { 
        ...baseItem, 
        markupEnabled: true, markupPercent: 20,
        discountEnabled: true, discountPercent: 10
      };
      expect(calculateItemUnitPrice(item)).toBe(1080);
    });

    it('should round to nearest integer', () => {
      const item: KpItem = { ...baseItem, price: 100, discountEnabled: true, discountPercent: 12.5 };
      // 100 - 12.5% = 87.5 -> round -> 88
      expect(calculateItemUnitPrice(item)).toBe(88);
    });

    it('should not return negative price', () => {
      const item: KpItem = { ...baseItem, price: 100, discountEnabled: true, discountPercent: 150 };
      expect(calculateItemUnitPrice(item)).toBe(0);
    });
  });

  describe('calculateKpTotals', () => {
    const items: KpItem[] = [
      {
        productId: '1',
        name: 'Item 1',
        description: '',
        unit: 'шт',
        price: 1000,
        qty: 2, // 2000
        markupEnabled: true, markupPercent: 10 // 1100 * 2 = 2200
      },
      {
        productId: '2',
        name: 'Item 2',
        description: '',
        unit: 'шт',
        price: 500,
        qty: 1, // 500
        discountEnabled: true, discountPercent: 20 // 400 * 1 = 400
      }
    ];

    it('should calculate subtotal correctly', () => {
      // 2200 + 400 = 2600
      const totals = calculateKpTotals(items, 20);
      expect(totals.subtotal).toBe(2600);
    });

    it('should calculate VAT correctly (included in subtotal)', () => {
      // subtotal = 2600
      // VAT = 20%
      // vatAmount = round(2600 * 20 / 120) = round(433.33) = 433
      const totals = calculateKpTotals(items, 20);
      expect(totals.vatAmount).toBe(433);
    });

    it('should calculate total equal to subtotal', () => {
      const totals = calculateKpTotals(items, 20);
      expect(totals.total).toBe(2600);
    });
  });
});

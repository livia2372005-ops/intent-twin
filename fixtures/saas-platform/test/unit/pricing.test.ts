import { describe, it, expect } from 'vitest';
import { calculateItemizedTotal } from '../../src/services/pricing.js';

describe('Pricing Calculation Unit Tests', () => {
  it('calculates subtotal and basic tax', () => {
    const items = [
      { name: 'Plan A', unitPriceCents: 1000, quantity: 1 },
      { name: 'Addon', unitPriceCents: 500, quantity: 2 },
    ];
    const res = calculateItemizedTotal(items, 20);
    expect(res.subtotalCents).toBe(2000);
    expect(res.totalCents).toBe(2400);
  });
});

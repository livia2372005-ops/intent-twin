export interface PricingItem {
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PricingCalculationResult {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  formatted: string;
}

// Baseline implementation: Integer cents arithmetic
export function calculateItemizedTotal(
  items: PricingItem[],
  vatRatePercent: number = 20
): PricingCalculationResult {
  let subtotalCents = 0;
  for (const item of items) {
    subtotalCents += item.unitPriceCents * item.quantity;
  }

  // Integer rounding for VAT in cents
  const vatCents = Math.round(subtotalCents * (vatRatePercent / 100));
  const totalCents = subtotalCents + vatCents;
  const formatted = `$${(totalCents / 100).toFixed(2)}`;

  return {
    subtotalCents,
    vatCents,
    totalCents,
    formatted,
  };
}

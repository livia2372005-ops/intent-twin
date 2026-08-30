import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pricingPath = path.resolve(__dirname, '../../src/services/pricing.ts');

export async function mutateReg05Precision() {
  const buggyPricingContent = `export interface PricingItem {
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

// Buggy float-based calculation introducing IEEE 754 precision drift
export function calculateItemizedTotal(
  items: PricingItem[],
  vatRatePercent: number = 20
): PricingCalculationResult {
  let subtotal = 0;
  for (const item of items) {
    subtotal += (item.unitPriceCents / 100) * item.quantity;
  }

  // Float math: subtotal * 1.2
  const total = subtotal * (1 + vatRatePercent / 100);
  const totalCents = total * 100; // Float precision bug!
  const formatted = \`$\${total.toFixed(3)}\`; // Corrupt precision

  return {
    subtotalCents: subtotal * 100,
    vatCents: (total - subtotal) * 100,
    totalCents,
    formatted,
  };
}
`;
  await fs.writeFile(pricingPath, buggyPricingContent, 'utf8');
}

if (process.argv[1]?.endsWith('reg-05-precision.ts') || process.argv[1]?.endsWith('reg-05-precision.js')) {
  mutateReg05Precision().then(() => console.log('Injected REG-05 (Float Precision Drift)'));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../src');

export async function resetBaseline(): Promise<void> {
  // 1. Reset src/routes/invoices.ts
  const invoicesContent = `import { Router, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { formatInvoiceHeader } from '../utils/format.js';

export const invoicesRouter = Router();

// 1. GET /api/invoices/summary - Calculates billing summary for active (non-soft-deleted) invoices
invoicesRouter.get('/summary', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const allInvoices = db.getAllInvoices();
  // Baseline check: only active, non-soft-deleted invoices for this tenant
  const tenantActiveInvoices = allInvoices.filter(
    inv => inv.orgId === req.user!.orgId && !inv.deletedAt
  );

  const totalAmountCents = tenantActiveInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);

  return res.json({
    orgId: req.user!.orgId,
    activeCount: tenantActiveInvoices.length,
    totalAmountCents,
  });
});

// 2. GET /api/invoices/:id - Retrieves invoice by ID with strict tenant check
invoicesRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const invoice = db.getInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Baseline IDOR check: must belong to the requesting user's organization
  if (invoice.orgId !== req.user!.orgId) {
    return res.status(403).json({ error: 'Forbidden: You do not own this invoice' });
  }

  const header = formatInvoiceHeader(invoice.id, '2026-08-30');

  return res.json({
    id: invoice.id,
    orgId: invoice.orgId,
    title: invoice.title,
    amountCents: invoice.amountCents,
    status: invoice.status,
    header,
  });
});

// 3. POST /api/invoices/:id/cancel - Cancels an invoice (Admin only)
invoicesRouter.post('/:id/cancel', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  // Baseline Permission check: must be admin
  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin role required to cancel invoices' });
  }

  const invoice = db.getInvoice(req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (invoice.orgId !== req.user!.orgId) {
    return res.status(403).json({ error: 'Forbidden: Cross-tenant operation' });
  }

  const updated = db.updateInvoice(req.params.id, { status: 'cancelled' });
  return res.json({ success: true, invoice: updated });
});
`;
  await fs.writeFile(path.join(srcDir, 'routes/invoices.ts'), invoicesContent, 'utf8');

  // 2. Reset src/routes/slots.ts
  const slotsContent = `import { Router, Response } from 'express';
import { db } from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

export const slotsRouter = Router();

// POST /api/slots/:id/book - Books a slot with concurrency protection
slotsRouter.post('/:id/book', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const slotId = req.params.id;

  // Baseline implementation uses atomic transactional reservation
  const result = await db.bookSlotAtomic(slotId, req.user!.id);

  if (!result.success) {
    return res.status(409).json({ error: result.error || 'Slot unavailable' });
  }

  return res.status(200).json({
    success: true,
    slotId,
    bookedBy: req.user!.id,
  });
});

// GET /api/slots/:id - Gets slot state
slotsRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const slot = db.getSlot(req.params.id);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });
  return res.json(slot);
});
`;
  await fs.writeFile(path.join(srcDir, 'routes/slots.ts'), slotsContent, 'utf8');

  // 3. Reset src/services/pricing.ts
  const pricingContent = `export interface PricingItem {
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
  const formatted = \`$\${(totalCents / 100).toFixed(2)}\`;

  return {
    subtotalCents,
    vatCents,
    totalCents,
    formatted,
  };
}
`;
  await fs.writeFile(path.join(srcDir, 'services/pricing.ts'), pricingContent, 'utf8');

  // 4. Reset src/utils/format.ts
  const formatContent = `export function formatInvoiceHeader(id: string, dateStr: string): string {
  return \`DOCUPAY INVOICE [\${id.toUpperCase()}] - ISSUED: \${dateStr}\`;
}
`;
  await fs.writeFile(path.join(srcDir, 'utils/format.ts'), formatContent, 'utf8');
}

if (process.argv[1]?.endsWith('reset-baseline.ts') || process.argv[1]?.endsWith('reset-baseline.js')) {
  resetBaseline().then(() => console.log('✓ Baseline reset complete.'));
}

import { Router, Response } from 'express';
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

import { Router, Response } from 'express';
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

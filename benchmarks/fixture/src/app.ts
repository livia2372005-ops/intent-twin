import express from 'express';
import { invoicesRouter } from './routes/invoices.js';
import { slotsRouter } from './routes/slots.js';
import { calculateItemizedTotal } from './services/pricing.js';

export const app = express();
app.use(express.json());

// Health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Pricing calculate route
app.post('/api/pricing/calculate', (req, res) => {
  const { items, vatPercent } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  const result = calculateItemizedTotal(items, vatPercent ?? 20);
  return res.json(result);
});

// Routers
app.use('/api/invoices', invoicesRouter);
app.use('/api/slots', slotsRouter);

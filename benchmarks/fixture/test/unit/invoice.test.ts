import { describe, it, expect } from 'vitest';
import { formatInvoiceHeader } from '../../src/utils/format.js';

describe('Invoice Header Format Unit Tests', () => {
  it('formats invoice header with id and date', () => {
    const formatted = formatInvoiceHeader('inv-001', '2026-08-30');
    expect(formatted).toContain('DOCUPAY INVOICE [INV-001]');
  });
});

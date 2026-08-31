import { app } from '../../src/app.js';
import { db } from '../../src/db.js';
import http from 'node:http';

export interface OracleReport {
  reg01_idor: { passed: boolean; details: string };
  reg02_concurrency: { passed: boolean; details: string };
  reg03_permission: { passed: boolean; details: string };
  reg04_soft_delete: { passed: boolean; details: string };
  reg05_precision: { passed: boolean; details: string };
  reg06_indirect: { passed: boolean; details: string };
}

export async function runOracleSuite(): Promise<OracleReport> {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    db.seed();

    // 1. Oracle REG-1: IDOR
    const res1 = await fetch(`${baseUrl}/api/invoices/inv-alpha-001`, {
      headers: { 'x-session-token': 'token-admin-beta' }, // Org B requesting Org A invoice
    });
    const reg01_passed = res1.status === 403;
    const reg01_details = reg01_passed
      ? 'Correct: Org B blocked from viewing Org A invoice (403)'
      : `Regression: Org B received invoice data (status ${res1.status})`;

    // 2. Oracle REG-2: Concurrency
    const slotPromises = [1, 2, 3, 4, 5].map((i) =>
      fetch(`${baseUrl}/api/slots/SLOT-101/book`, {
        method: 'POST',
        headers: { 'x-session-token': 'token-admin-alpha' },
      })
    );
    const slotResponses = await Promise.all(slotPromises);
    const successCount = slotResponses.filter(r => r.status === 200).length;
    const conflictCount = slotResponses.filter(r => r.status === 409).length;
    const reg02_passed = successCount === 1 && conflictCount === 4;
    const reg02_details = reg02_passed
      ? `Correct: Exactly 1 concurrent booking succeeded, 4 rejected (409)`
      : `Regression: Concurrency race condition detected! ${successCount} bookings succeeded`;

    // 3. Oracle REG-3: Permission
    const res3 = await fetch(`${baseUrl}/api/invoices/inv-alpha-001/cancel`, {
      method: 'POST',
      headers: { 'x-session-token': 'token-member-alpha' }, // Member trying to cancel
    });
    const reg03_passed = res3.status === 403;
    const reg03_details = reg03_passed
      ? 'Correct: Member blocked from cancelling invoice (403)'
      : `Regression: Member allowed to cancel invoice (status ${res3.status})`;

    // 4. Oracle REG-4: Soft-Delete Summary
    const res4 = await fetch(`${baseUrl}/api/invoices/summary`, {
      headers: { 'x-session-token': 'token-admin-alpha' },
    });
    const data4 = await res4.json();
    // Org Alpha has inv-001 ($500) active and inv-002 ($100) soft-deleted -> total must be 50000
    const reg04_passed = data4.totalAmountCents === 50000;
    const reg04_details = reg04_passed
      ? 'Correct: Soft-deleted invoice excluded from summary total ($500.00)'
      : `Regression: Soft-deleted invoice included in summary total ($${(data4.totalAmountCents / 100).toFixed(2)})`;

    // 5. Oracle REG-5: Integer Precision
    const res5 = await fetch(`${baseUrl}/api/pricing/calculate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [{ name: 'Widget', unitPriceCents: 1999, quantity: 3 }],
        vatPercent: 20,
      }),
    });
    const data5 = await res5.json();
    const reg05_passed = data5.totalCents === 7196 && data5.formatted === '$71.96';
    const reg05_details = reg05_passed
      ? 'Correct: Integer precision preserved (totalCents: 7196, formatted: "$71.96")'
      : `Regression: Float precision drift! Received totalCents: ${data5.totalCents}, formatted: "${data5.formatted}"`;

    // 6. Oracle REG-6: Indirect Formatting
    const res6 = await fetch(`${baseUrl}/api/invoices/inv-alpha-001`, {
      headers: { 'x-session-token': 'token-admin-alpha' },
    });
    const data6 = await res6.json();
    const reg06_passed = data6.header && data6.header.includes('DOCUPAY INVOICE [INV-ALPHA-001]');
    const reg06_details = reg06_passed
      ? 'Correct: Invoice header format valid'
      : `Regression: Invoice header format corrupted ("${data6.header}")`;

    return {
      reg01_idor: { passed: reg01_passed, details: reg01_details },
      reg02_concurrency: { passed: reg02_passed, details: reg02_details },
      reg03_permission: { passed: reg03_passed, details: reg03_details },
      reg04_soft_delete: { passed: reg04_passed, details: reg04_details },
      reg05_precision: { passed: reg05_passed, details: reg05_details },
      reg06_indirect: { passed: reg06_passed, details: reg06_details },
    };
  } finally {
    server.close();
  }
}

// CLI execution
if (process.argv[1]?.endsWith('oracle-all.ts') || process.argv[1]?.endsWith('oracle-all.js')) {
  runOracleSuite().then(report => {
    console.log(JSON.stringify(report, null, 2));
  });
}

import http from 'node:http';
import { app } from '../../src/app.js';
import { db } from '../../src/db.js';

const probeName = process.argv[2];

async function run() {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    db.seed();

    switch (probeName) {
      case 'idor': {
        // Org B requesting Org A invoice must return 403
        const res = await fetch(`${baseUrl}/api/invoices/inv-alpha-001`, {
          headers: { 'x-session-token': 'token-admin-beta' },
        });
        if (res.status !== 403) {
          console.error(`IDOR probe failed: Expected status 403 Forbidden, got ${res.status}`);
          process.exit(1);
        }
        console.log('IDOR probe passed (403 Forbidden)');
        break;
      }

      case 'concurrency': {
        // Fire 5 concurrent bookings against SLOT-101
        const promises = [1, 2, 3, 4, 5].map(() =>
          fetch(`${baseUrl}/api/slots/SLOT-101/book`, {
            method: 'POST',
            headers: { 'x-session-token': 'token-admin-alpha' },
          })
        );
        const responses = await Promise.all(promises);
        const successes = responses.filter(r => r.status === 200).length;
        const conflicts = responses.filter(r => r.status === 409).length;

        if (successes !== 1 || conflicts !== 4) {
          console.error(`Concurrency probe failed: Expected exactly 1 success (200) and 4 conflicts (409). Got ${successes} successes and ${conflicts} conflicts.`);
          process.exit(1);
        }
        console.log(`Concurrency probe passed: 1 booking succeeded, 4 rejected`);
        break;
      }

      case 'permission': {
        // Member requesting invoice cancellation must return 403
        const res = await fetch(`${baseUrl}/api/invoices/inv-alpha-001/cancel`, {
          method: 'POST',
          headers: { 'x-session-token': 'token-member-alpha' },
        });
        if (res.status !== 403) {
          console.error(`Permission probe failed: Expected status 403 Forbidden, got ${res.status}`);
          process.exit(1);
        }
        console.log('Permission probe passed (403 Forbidden)');
        break;
      }

      case 'soft-delete': {
        // Summary must equal 50000 cents ($500.00), excluding soft-deleted $100 invoice
        const res = await fetch(`${baseUrl}/api/invoices/summary`, {
          headers: { 'x-session-token': 'token-admin-alpha' },
        });
        const data = await res.json();
        if (data.totalAmountCents !== 50000) {
          console.error(`Soft-delete probe failed: Expected totalAmountCents 50000, got ${data.totalAmountCents}`);
          process.exit(1);
        }
        console.log('Soft-delete probe passed (50000 cents)');
        break;
      }

      case 'precision': {
        // Price 3 x 19.99 + 20% VAT must equal 7196 cents ($71.96)
        const res = await fetch(`${baseUrl}/api/pricing/calculate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            items: [{ name: 'Widget', unitPriceCents: 1999, quantity: 3 }],
            vatPercent: 20,
          }),
        });
        const data = await res.json();
        if (data.totalCents !== 7196 || data.formatted !== '$71.96') {
          console.error(`Precision probe failed: Expected totalCents: 7196, formatted: "$71.96", got totalCents: ${data.totalCents}, formatted: "${data.formatted}"`);
          process.exit(1);
        }
        console.log('Precision probe passed ($71.96 / 7196 cents)');
        break;
      }

      case 'format': {
        // Header must contain DOCUPAY INVOICE [INV-ALPHA-001]
        const res = await fetch(`${baseUrl}/api/invoices/inv-alpha-001`, {
          headers: { 'x-session-token': 'token-admin-alpha' },
        });
        const data = await res.json();
        if (!data.header || !data.header.includes('DOCUPAY INVOICE [INV-ALPHA-001]')) {
          console.error(`Format probe failed: Expected header containing "DOCUPAY INVOICE [INV-ALPHA-001]", got "${data.header}"`);
          process.exit(1);
        }
        console.log('Format probe passed');
        break;
      }

      default:
        console.error(`Unknown probe name: ${probeName}`);
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`Probe exception: ${err.message}`);
    process.exit(1);
  } finally {
    server.close();
  }
}

run();

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const invoicesPath = path.resolve(__dirname, '../../src/routes/invoices.ts');

export async function mutateCtrlBRefactor() {
  let content = await fs.readFile(invoicesPath, 'utf8');
  // Clean behavior-preserving refactor (rewriting array reduce using helper function)
  content = content.replace(
    'const totalAmountCents = tenantActiveInvoices.reduce((sum, inv) => sum + inv.amountCents, 0);',
    'const sumAmounts = (list: typeof tenantActiveInvoices) => list.map(i => i.amountCents).reduce((a, b) => a + b, 0);\n  const totalAmountCents = sumAmounts(tenantActiveInvoices);'
  );
  await fs.writeFile(invoicesPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('ctrl-b-refactor.ts') || process.argv[1]?.endsWith('ctrl-b-refactor.js')) {
  mutateCtrlBRefactor().then(() => console.log('Injected CTRL-B (Behavior-Preserving Refactor)'));
}

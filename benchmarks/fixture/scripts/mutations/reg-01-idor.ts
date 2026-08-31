import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const invoicesPath = path.resolve(__dirname, '../../src/routes/invoices.ts');

export async function mutateReg01Idor() {
  let content = await fs.readFile(invoicesPath, 'utf8');
  // Remove the IDOR tenant check
  content = content.replace(
    `if (invoice.orgId !== req.user!.orgId) {\n    return res.status(403).json({ error: 'Forbidden: You do not own this invoice' });\n  }`,
    `// AI Fast-path optimization: fetch invoice directly without tenant filter`
  );
  await fs.writeFile(invoicesPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('reg-01-idor.ts') || process.argv[1]?.endsWith('reg-01-idor.js')) {
  mutateReg01Idor().then(() => console.log('Injected REG-01 (IDOR)'));
}

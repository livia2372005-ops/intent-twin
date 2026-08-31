import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const invoicesPath = path.resolve(__dirname, '../../src/routes/invoices.ts');

export async function mutateReg04SoftDelete() {
  let content = await fs.readFile(invoicesPath, 'utf8');
  // Remove !inv.deletedAt check
  content = content.replace('inv.orgId === req.user!.orgId && !inv.deletedAt', 'inv.orgId === req.user!.orgId');
  await fs.writeFile(invoicesPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('reg-04-soft-delete.ts') || process.argv[1]?.endsWith('reg-04-soft-delete.js')) {
  mutateReg04SoftDelete().then(() => console.log('Injected REG-04 (Soft Delete Summary Leak)'));
}

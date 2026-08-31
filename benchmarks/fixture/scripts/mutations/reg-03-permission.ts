import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const invoicesPath = path.resolve(__dirname, '../../src/routes/invoices.ts');

export async function mutateReg03Permission() {
  let content = await fs.readFile(invoicesPath, 'utf8');
  // Change role admin check to Boolean(user)
  content = content.replace("req.user!.role !== 'admin'", "!req.user");
  await fs.writeFile(invoicesPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('reg-03-permission.ts') || process.argv[1]?.endsWith('reg-03-permission.js')) {
  mutateReg03Permission().then(() => console.log('Injected REG-03 (Permission Privilege Escalation)'));
}

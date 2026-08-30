import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slotsPath = path.resolve(__dirname, '../../src/routes/slots.ts');

export async function mutateReg02Concurrency() {
  let content = await fs.readFile(slotsPath, 'utf8');
  // Change bookSlotAtomic to bookSlotNonAtomic
  content = content.replace('bookSlotAtomic', 'bookSlotNonAtomic');
  await fs.writeFile(slotsPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('reg-02-concurrency.ts') || process.argv[1]?.endsWith('reg-02-concurrency.js')) {
  mutateReg02Concurrency().then(() => console.log('Injected REG-02 (Concurrency Race Condition)'));
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const formatPath = path.resolve(__dirname, '../../src/utils/format.ts');

export async function mutateReg06IndirectDependency() {
  let content = await fs.readFile(formatPath, 'utf8');
  // Corrupt format output in unmapped indirect dependency
  content = content.replace('DOCUPAY INVOICE', 'CORRUPT_HEADER');
  await fs.writeFile(formatPath, content, 'utf8');
}

if (process.argv[1]?.endsWith('reg-06-indirect-dependency.ts') || process.argv[1]?.endsWith('reg-06-indirect-dependency.js')) {
  mutateReg06IndirectDependency().then(() => console.log('Injected REG-06 (Indirect Dependency Regression)'));
}

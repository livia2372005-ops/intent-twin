import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { inferProductContract } from '../src/infer/genesis.js';
import { DEFAULT_CONTRACT_FILE, INFERRED_CONTRACT_FILE } from '../src/contract/parser.js';

describe('Spec Genesis / Inference (Non-destructive by default)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-twin-infer-test-'));

    // Setup fake web project structure
    await fs.writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-infer-app', description: 'Testing reverse spec' }, null, 2),
      'utf8'
    );

    const pagesDir = path.join(tmpDir, 'src/pages');
    await fs.mkdir(pagesDir, { recursive: true });
    await fs.writeFile(path.join(pagesDir, 'dashboard.tsx'), 'export default function Dashboard() {}', 'utf8');
    await fs.writeFile(path.join(pagesDir, 'checkout.tsx'), 'export default function Checkout() {}', 'utf8');
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates proposal at .intent/product.inferred.yaml by default without mutating main contract', async () => {
    const result = await inferProductContract({ workspaceRoot: tmpDir });

    expect(result.isApplied).toBe(false);
    expect(result.contract.product.name).toBe('my-infer-app');
    expect(result.contract.requirements.length).toBeGreaterThanOrEqual(2);

    // Verify .intent/product.inferred.yaml exists
    const inferredStat = await fs.stat(path.join(tmpDir, INFERRED_CONTRACT_FILE));
    expect(inferredStat.isFile()).toBe(true);

    // Verify requirements have explicit inferred provenance
    expect(result.contract.requirements[0].provenance?.type).toBe('inferred');
    expect(result.contract.requirements[0].provenance?.inferredAt).toBeDefined();

    // Verify .intent/product.yaml DOES NOT exist
    const mainStatExists = await fs.stat(path.join(tmpDir, DEFAULT_CONTRACT_FILE)).then(() => true).catch(() => false);
    expect(mainStatExists).toBe(false);
  });

  it('merges into .intent/product.yaml when apply: true is passed', async () => {
    const result = await inferProductContract({ workspaceRoot: tmpDir, apply: true });

    expect(result.isApplied).toBe(true);
    const mainStat = await fs.stat(path.join(tmpDir, DEFAULT_CONTRACT_FILE));
    expect(mainStat.isFile()).toBe(true);
  });
});

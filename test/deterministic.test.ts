import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { runFileProbe, runExecProbe, runHttpProbe } from '../src/engine/layer-a-deterministic.js';
import { verifyItem, runVerification } from '../src/engine/runner.js';
import type { ProductContract } from '../src/contract/types.js';

describe('Layer A Deterministic Probes & Verification Semantics', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-twin-test-'));
    await fs.writeFile(path.join(tmpDir, 'auth.ts'), 'export const login = () => true;\n', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'leak.ts'), 'const SECRET_KEY = "12345";\n', 'utf8');
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('verifies file probe pattern match (PASS)', async () => {
    const res = await runFileProbe(
      { type: 'file', path: 'auth.ts', pattern: 'login' },
      tmpDir
    );
    expect(res.status).toBe('PASS');
  });

  it('fails file probe on pattern mismatch (FAIL)', async () => {
    const res = await runFileProbe(
      { type: 'file', path: 'auth.ts', pattern: 'nonExistentFunction' },
      tmpDir
    );
    expect(res.status).toBe('FAIL');
    expect(res.message).toContain('does not match required pattern');
  });

  it('fails file probe on notPattern match (FAIL)', async () => {
    const res = await runFileProbe(
      { type: 'file', path: 'leak.ts', notPattern: 'SECRET_KEY' },
      tmpDir
    );
    expect(res.status).toBe('FAIL');
    expect(res.message).toContain('forbidden pattern');
  });

  it('returns UNKNOWN for unreachable HTTP target', async () => {
    const res = await runHttpProbe({
      type: 'http',
      url: 'http://127.0.0.1:59999/unreachable-port-endpoint',
      timeoutMs: 500,
    });
    expect(res.status).toBe('UNKNOWN');
  });

  it('verifies exec probe (PASS & FAIL)', async () => {
    const passRes = await runExecProbe(
      { type: 'exec', command: 'node -e "console.log(\'hello\')"', expectOutputPattern: 'hello' },
      tmpDir
    );
    expect(passRes.status).toBe('PASS');

    const failRes = await runExecProbe(
      { type: 'exec', command: 'node -e "process.exit(2)"', expectExitCode: 0 },
      tmpDir
    );
    expect(failRes.status).toBe('FAIL');
  });

  it('enforces strict verification semantics: No probes -> UNKNOWN', async () => {
    const res = await verifyItem(
      { id: 'R-001', title: 'Underspecified Feature', statement: 'Feature with no probes' },
      'requirement',
      { workspaceRoot: tmpDir }
    );
    expect(res.status).toBe('UNKNOWN');
    expect(res.reason).toContain('No executable probes defined');
  });

  it('enforces strict verification semantics: Any probe fail -> FAIL', async () => {
    const contract: ProductContract = {
      version: '0.1',
      product: { name: 'Semantics Test' },
      requirements: [
        {
          id: 'R-001',
          title: 'Mixed Probes',
          statement: 'One pass, one fail',
          probes: [
            { type: 'file', path: 'auth.ts', pattern: 'login' }, // PASS
            { type: 'file', path: 'auth.ts', pattern: 'missingSymbol' }, // FAIL
          ],
        },
      ],
    };

    const summary = await runVerification(contract, { workspaceRoot: tmpDir });
    expect(summary.total).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[0].status).toBe('FAIL');
  });
});

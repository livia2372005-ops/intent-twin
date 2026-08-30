import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const intentTwinBin = path.resolve(repoRoot, 'bin/intent-twin.js');
const smokeAppDir = path.resolve(repoRoot, 'scratch_validation/oss-smoke-app');

async function runCli(cmd: string, cwd: string) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 20000 });
    return { success: true, stdout, stderr, code: 0 };
  } catch (err: any) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code: typeof err.code === 'number' ? err.code : 1,
    };
  }
}

describe('Real-User OSS Smoke Test (Clean App Flow)', () => {
  beforeEach(async () => {
    await fs.rm(smokeAppDir, { recursive: true, force: true });
    await fs.mkdir(smokeAppDir, { recursive: true });

    // Scaffold a brand new user web application
    await fs.writeFile(
      path.join(smokeAppDir, 'package.json'),
      JSON.stringify(
        {
          name: 'acme-portal',
          version: '1.0.0',
          scripts: {
            start: 'node src/index.js',
          },
        },
        null,
        2
      )
    );

    await fs.mkdir(path.join(smokeAppDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(smokeAppDir, 'src/auth.js'),
      `export function checkAccess(user) {
  if (!user || user.role !== 'admin') {
    return false;
  }
  return true;
}
`
    );

    // Initialize git repo for the user app
    await runCli('git init', smokeAppDir);
    await runCli('git config user.name "SmokeTester"', smokeAppDir);
    await runCli('git config user.email "smoke@acme.com"', smokeAppDir);
    await runCli('git add .', smokeAppDir);
    await runCli('git commit -m "Initial commit of Acme Portal"', smokeAppDir);
  });

  afterEach(async () => {
    await fs.rm(smokeAppDir, { recursive: true, force: true });
  });

  it('executes complete developer lifecycle: init -> infer -> verify -> mutate -> drift -> fix -> stable', async () => {
    // 1. init
    const initRes = await runCli(`node "${intentTwinBin}" init`, smokeAppDir);
    expect(initRes.success).toBe(true);
    expect(initRes.stdout).toContain('IntentTwin initialized successfully!');
    expect(await fs.stat(path.join(smokeAppDir, '.intent/product.yaml'))).toBeDefined();
    expect(await fs.stat(path.join(smokeAppDir, 'AGENTS.md'))).toBeDefined();

    // 2. infer
    const inferRes = await runCli(`node "${intentTwinBin}" infer`, smokeAppDir);
    expect(inferRes.success).toBe(true);
    expect(inferRes.stdout).toContain('Inferred');
    expect(await fs.stat(path.join(smokeAppDir, '.intent/product.inferred.yaml'))).toBeDefined();

    // 3. customize contract with executable probe
    const userContract = `version: "0.1"
product:
  name: "acme-portal"
  description: "Enterprise admin portal"
requirements:
  - id: "R-001"
    title: "Admin Access Control"
    statement: "Non-admin users cannot access admin dashboard"
    critical: true
    sources:
      - "src/auth.js"
    probes:
      - type: "exec"
        command: "node -e \\"import('./src/auth.js').then(m => { if (m.checkAccess({ role: 'member' })) process.exit(1); })\\""
`;
    await fs.writeFile(path.join(smokeAppDir, '.intent/product.yaml'), userContract, 'utf8');

    // 4. verify baseline
    const verifyRes = await runCli(`node "${intentTwinBin}" verify`, smokeAppDir);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.stdout).toContain('1 PASS');
    expect(verifyRes.stdout).toContain('0 FAIL');

    // Commit contract so git diff tracks subsequent changes
    await runCli('git add .intent/product.yaml', smokeAppDir);
    await runCli('git commit -m "Add verified Product Contract"', smokeAppDir);

    // Save baseline state
    await runCli(`node "${intentTwinBin}" verify`, smokeAppDir);

    // 5. introduce intentional regression in src/auth.js
    await fs.writeFile(
      path.join(smokeAppDir, 'src/auth.js'),
      `export function checkAccess(user) {
  // BUGGY AI REGRESSION: allow all users
  return true;
}
`
    );

    // 6. drift should detect regression
    const driftRes = await runCli(`node "${intentTwinBin}" drift`, smokeAppDir);
    expect(driftRes.success).toBe(false);
    expect(driftRes.stdout).toContain('DRIFT');
    expect(driftRes.stdout).toContain('R-001');
    expect(driftRes.stdout).toContain('Admin Access Control');
    expect(driftRes.stdout).toContain('1 DRIFT DETECTED');

    // 7. fix regression
    await fs.writeFile(
      path.join(smokeAppDir, 'src/auth.js'),
      `export function checkAccess(user) {
  if (!user || user.role !== 'admin') {
    return false;
  }
  return true;
}
`
    );

    // 8. drift should return to clean state
    const fixedDriftRes = await runCli(`node "${intentTwinBin}" drift`, smokeAppDir);
    expect(fixedDriftRes.success).toBe(true);
    expect(fixedDriftRes.stdout).toContain('No affected requirements found');
  });
});

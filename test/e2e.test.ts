import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { generateAgentIntegrations } from '../src/integrations/agent-files.js';
import { saveContract, loadContract, DEFAULT_CONTRACT_FILE } from '../src/contract/parser.js';
import { inferProductContract } from '../src/infer/genesis.js';
import { runVerification } from '../src/engine/runner.js';
import { saveEvidence } from '../src/evidence/collector.js';
import { saveVerificationState } from '../src/drift/state.js';
import { detectDrift } from '../src/drift/detector.js';

describe('End-to-End Workspace Workflow (init -> infer -> verify -> drift)', () => {
  let workspaceRoot: string;

  beforeAll(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-twin-e2e-'));

    // Create a mock web project
    await fs.writeFile(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({ name: 'e2e-demo-saas', description: 'AI Built SaaS App' }, null, 2),
      'utf8'
    );

    const pagesDir = path.join(workspaceRoot, 'src/pages');
    await fs.mkdir(pagesDir, { recursive: true });
    await fs.writeFile(path.join(pagesDir, 'login.tsx'), 'export default function Login() { return <form>Login</form>; }', 'utf8');
    await fs.writeFile(path.join(pagesDir, 'dashboard.tsx'), 'export default function Dashboard() { return <div>Welcome</div>; }', 'utf8');
  });

  afterAll(async () => {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it('Step 1 (init): Generates agent files and initial contract', async () => {
    const createdAgentFiles = await generateAgentIntegrations({ workspaceRoot });
    expect(createdAgentFiles).toContain('AGENTS.md');
    expect(createdAgentFiles).toContain('CLAUDE.md');
    expect(createdAgentFiles).toContain('.agents/skills/intent-twin/SKILL.md');
    expect(createdAgentFiles).toContain('.cursor/rules/intent-twin.mdc');

    const agentsMd = await fs.readFile(path.join(workspaceRoot, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('IntentTwin');
  });

  it('Step 2 (infer): Discovers pages and infers requirements non-destructively', async () => {
    const inferRes = await inferProductContract({ workspaceRoot, apply: false });
    expect(inferRes.isApplied).toBe(false);
    expect(inferRes.contract.requirements.length).toBe(2);

    // Now apply into product.yaml
    const appliedRes = await inferProductContract({ workspaceRoot, apply: true });
    expect(appliedRes.isApplied).toBe(true);

    const { contract } = await loadContract(workspaceRoot);
    expect(contract.product.name).toBe('e2e-demo-saas');
    expect(contract.requirements.map(r => r.id)).toContain('R-001');
  });

  it('Step 3 (verify): Runs deterministic verification and collects evidence', async () => {
    const { contract } = await loadContract(workspaceRoot);
    const summary = await runVerification(contract, { workspaceRoot });

    expect(summary.total).toBe(3); // 2 requirements + 1 invariant
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.unknown).toBe(0);

    const evidenceDir = await saveEvidence(workspaceRoot, summary);
    await saveVerificationState(workspaceRoot, summary);

    const summaryJson = await fs.readFile(path.join(evidenceDir, 'summary.json'), 'utf8');
    expect(JSON.parse(summaryJson).passed).toBe(3);
  });

  it('Step 4 (drift): Detects breakage when source file pattern is broken', async () => {
    const { contract } = await loadContract(workspaceRoot);

    // Add a strict pattern requirement
    contract.requirements[0].probes = [
      {
        type: 'file',
        path: 'src/pages/login.tsx',
        pattern: '<form>Login</form>',
      },
    ];
    await saveContract(path.join(workspaceRoot, DEFAULT_CONTRACT_FILE), contract);

    // First verification: PASS
    const baselineSummary = await runVerification(contract, { workspaceRoot });
    expect(baselineSummary.results[0].status).toBe('PASS');
    await saveVerificationState(workspaceRoot, baselineSummary);

    // AI edits the login page and accidentally removes the form
    await fs.writeFile(path.join(workspaceRoot, 'src/pages/login.tsx'), 'export default function Login() { return <div>Removed form</div>; }', 'utf8');

    // Run verification on affected requirement
    const driftResult = await detectDrift({ workspaceRoot, contract });
    // In our test, if git is not initialized in tmpDir, verifyItem directly tests requirement status
    const req = contract.requirements[0];
    const itemResult = await (await import('../src/engine/runner.js')).verifyItem(req, 'requirement', { workspaceRoot });
    expect(itemResult.status).toBe('FAIL');
    expect(itemResult.reason).toContain('does not match required pattern');
  });
});

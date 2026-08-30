import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs/promises';
import pc from 'picocolors';
import { loadContract, saveContract, DEFAULT_CONTRACT_FILE } from './contract/parser.js';
import type { ProductContract } from './contract/types.js';
import { runVerification } from './engine/runner.js';
import { saveEvidence } from './evidence/collector.js';
import { saveVerificationState } from './drift/state.js';
import { detectDrift } from './drift/detector.js';
import { inferProductContract } from './infer/genesis.js';
import { generateAgentIntegrations } from './integrations/agent-files.js';
import { getGitChanges } from './drift/git.js';

const program = new Command();

program
  .name('intent-twin')
  .description('Open-source, local-first Product Contract and verification layer for AI coding agents')
  .version('0.1.0');

// 1. init
program
  .command('init')
  .description('Initialize IntentTwin in the current repository')
  .option('-f, --force', 'Overwrite existing contract and integration files', false)
  .option('-m, --minimal', 'Skip generating agent instructions', false)
  .action(async (options) => {
    const cwd = process.cwd();
    console.log(pc.bold(pc.cyan('\n[IntentTwin] Initializing workspace...')));

    const contractPath = path.join(cwd, DEFAULT_CONTRACT_FILE);
    const contractExists = await fs.stat(contractPath).then(() => true).catch(() => false);

    if (!contractExists || options.force) {
      const defaultContract: ProductContract = {
        version: '0.1',
        product: {
          name: path.basename(cwd),
          description: 'Web application managed by IntentTwin',
          entrypoint: 'http://localhost:3000',
        },
        requirements: [
          {
            id: 'R-001',
            title: 'Initial Application Smoke Check',
            statement: 'Application structure and package metadata exist',
            critical: true,
            sources: ['package.json'],
            probes: [
              {
                type: 'file',
                path: 'package.json',
                mustExist: true,
              },
            ],
          },
        ],
        invariants: [
          {
            id: 'I-001',
            statement: 'No secrets or private keys checked in',
            sources: ['.env', 'src/'],
            probes: [
              {
                type: 'file',
                path: 'src/',
                notPattern: 'SECRET_KEY|DATABASE_URL|PRIVATE_KEY',
              },
            ],
          },
        ],
      };

      await saveContract(contractPath, defaultContract);
      console.log(pc.green(`  ✓ Created Product Contract: ${DEFAULT_CONTRACT_FILE}`));
    } else {
      console.log(pc.yellow(`  ℹ Product Contract already exists at ${DEFAULT_CONTRACT_FILE}`));
    }

    if (!options.minimal) {
      const created = await generateAgentIntegrations({ workspaceRoot: cwd, force: options.force });
      for (const file of created) {
        console.log(pc.green(`  ✓ Created Agent Integration: ${file}`));
      }
    }

    console.log(pc.bold(pc.green('\nIntentTwin initialized successfully!')));
    console.log(pc.dim('Next steps:'));
    console.log(pc.dim('  • Run `intent-twin infer` to reverse-engineer requirements from your codebase.'));
    console.log(pc.dim('  • Run `intent-twin verify` to verify current product intent.'));
    console.log(pc.dim('  • Run `intent-twin drift` to detect regressions across git changes.\n'));
  });

// 2. infer
program
  .command('infer')
  .description('Reverse-engineer a candidate Product Contract from repository code')
  .option('-a, --apply', 'Apply and merge inferred contract directly into .intent/product.yaml', false)
  .option('-o, --out <path>', 'Custom output path for inferred contract')
  .action(async (options) => {
    const cwd = process.cwd();
    console.log(pc.bold(pc.cyan('\n[IntentTwin] Inferring Product Contract from codebase...')));

    try {
      const result = await inferProductContract({
        workspaceRoot: cwd,
        apply: options.apply,
        outputPath: options.out,
      });

      console.log(pc.green(`\n✓ Inferred ${result.contract.requirements.length} requirements and ${result.contract.invariants?.length || 0} invariants.`));
      console.log(pc.cyan(`  Output saved to: ${path.relative(cwd, result.savedPath)}`));

      if (!result.isApplied) {
        console.log(pc.yellow('\nℹ Note: Inference is a proposal. Review the generated file or run:'));
        console.log(pc.dim('  intent-twin infer --apply'));
      } else {
        console.log(pc.green('  Applied to main Product Contract (.intent/product.yaml).'));
      }
      console.log();
    } catch (err: any) {
      console.error(pc.red(`\n✗ Inference failed: ${err.message}\n`));
      process.exit(1);
    }
  });

// 3. verify
program
  .command('verify')
  .description('Verify product contract requirements against deterministic and behavioral probes')
  .option('--id <id>', 'Verify a specific requirement or invariant ID')
  .option('--json', 'Output results formatted as JSON', false)
  .action(async (options) => {
    const cwd = process.cwd();

    try {
      const { contract } = await loadContract(cwd);
      const summary = await runVerification(contract, {
        workspaceRoot: cwd,
        targetId: options.id,
      });

      const evidenceDir = await saveEvidence(cwd, summary);
      const gitChanges = await getGitChanges(cwd);
      await saveVerificationState(cwd, summary, gitChanges.currentCommit);

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
        if (summary.failed > 0) process.exit(1);
        return;
      }

      console.log(pc.bold(pc.cyan(`\n[IntentTwin] Verification Summary — ${contract.product.name}`)));
      console.log(pc.dim(`Timestamp: ${summary.timestamp} | Commit: ${gitChanges.currentCommit?.slice(0, 7) || 'uncommitted'}`));
      console.log(pc.dim(`Total: ${summary.total} | Duration: ${summary.durationMs}ms\n`));

      for (const res of summary.results) {
        const icon =
          res.status === 'PASS' ? pc.green('✓ PASS') :
          res.status === 'FAIL' ? pc.red('✗ FAIL') :
          pc.yellow('? UNKNOWN');

        console.log(`  ${icon}  ${pc.bold(res.id)} ${pc.dim(res.title || res.statement)}`);
        if (res.status === 'FAIL' && res.reason) {
          console.log(pc.red(`         └─ Error: ${res.reason}`));
        } else if (res.status === 'UNKNOWN' && res.reason) {
          console.log(pc.yellow(`         └─ Note: ${res.reason}`));
        }
      }

      console.log('\n' + pc.bold('Results: ') +
        pc.green(`${summary.passed} PASS`) + '  ' +
        pc.red(`${summary.failed} FAIL`) + '  ' +
        pc.yellow(`${summary.unknown} UNKNOWN`)
      );

      console.log(pc.dim(`Evidence saved to: ${path.relative(cwd, evidenceDir)}\n`));

      if (summary.failed > 0) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`\n✗ Verification failed: ${err.message}\n`));
      process.exit(1);
    }
  });

// 4. drift
program
  .command('drift')
  .description('Inspect Git changes and detect product drift on affected requirements')
  .option('--json', 'Output drift report formatted as JSON', false)
  .action(async (options) => {
    const cwd = process.cwd();

    try {
      const report = await detectDrift({ workspaceRoot: cwd });

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        if (report.summary.driftDetected > 0) process.exit(1);
        return;
      }

      console.log(pc.bold(pc.cyan('\n[IntentTwin] Product Drift Report')));
      console.log(pc.dim(`Base Commit: ${report.baseCommit?.slice(0, 7) || 'none'} → Current: ${report.currentCommit?.slice(0, 7) || 'working tree'}`));
      console.log(pc.dim(`Changed files (${report.changedFiles.length}): ${report.changedFiles.slice(0, 5).join(', ')}${report.changedFiles.length > 5 ? '...' : ''}\n`));

      if (report.affectedRequirements.length === 0) {
        console.log(pc.green('✓ No affected requirements found for current file modifications.\n'));
        return;
      }

      for (const item of report.affectedRequirements) {
        const driftIcon =
          item.driftStatus === 'DRIFT_DETECTED' ? pc.red('✗ DRIFT') :
          item.driftStatus === 'STABLE' ? pc.green('✓ STABLE') :
          pc.yellow('? UNVERIFIED');

        console.log(`  ${driftIcon}  ${pc.bold(item.id)} ${pc.dim(item.title || item.statement)}`);
        console.log(`         Current: ${item.currentStatus} (Previous: ${item.previousStatus || 'none'})`);
        console.log(pc.dim(`         Files: ${item.affectedByFiles.join(', ')}`));
        if (item.driftStatus === 'DRIFT_DETECTED') {
          console.log(pc.red(`         └─ ${item.reason}`));
        }
      }

      console.log('\n' + pc.bold('Drift Summary: ') +
        (report.summary.driftDetected > 0 ? pc.red(`${report.summary.driftDetected} DRIFT DETECTED`) : pc.green('0 DRIFT')) + '  ' +
        pc.green(`${report.summary.stable} STABLE`) + '  ' +
        pc.yellow(`${report.summary.unverified} UNVERIFIED\n`)
      );

      if (report.summary.driftDetected > 0) {
        process.exit(1);
      }
    } catch (err: any) {
      console.error(pc.red(`\n✗ Drift check failed: ${err.message}\n`));
      process.exit(1);
    }
  });

program.parse();

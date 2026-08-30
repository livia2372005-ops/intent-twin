import fs from 'node:fs/promises';
import path from 'node:path';

export interface GenerateIntegrationsOptions {
  workspaceRoot: string;
  force?: boolean;
}

export async function generateAgentIntegrations(options: GenerateIntegrationsOptions): Promise<string[]> {
  const { workspaceRoot, force = false } = options;
  const createdFiles: string[] = [];

  const writeIfNotExists = async (relPath: string, content: string) => {
    const target = path.join(workspaceRoot, relPath);
    const exists = await fs.stat(target).then(() => true).catch(() => false);
    if (!exists || force) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content.trim() + '\n', 'utf8');
      createdFiles.push(relPath);
    }
  };

  // 1. AGENTS.md
  const agentsMdContent = `
# Product Intent Contract & Verification

This repository uses **IntentTwin** to enforce the Product Contract and detect Product Drift.

## Rules for AI Coding Agents:
1. **Source of Truth**: The intended product behavior is documented in \`.intent/product.yaml\`.
2. **Before Editing**: Inspect \`.intent/product.yaml\` to understand required behaviors, invariants, and sources.
3. **After Editing**:
   - Run drift check to ensure your edits did not break product intent:
     \`\`\`bash
     npx intent-twin drift
     \`\`\`
   - Run verification if adding or testing requirements:
     \`\`\`bash
     npx intent-twin verify
     \`\`\`
4. **Drift Policy**: If \`intent-twin drift\` reports regressions or failures, fix the implementation before completing your task.
`;
  await writeIfNotExists('AGENTS.md', agentsMdContent);

  // 2. CLAUDE.md
  const claudeMdContent = `
# Claude Code Project Guidelines

## IntentTwin Product Verification
- Product Contract: \`.intent/product.yaml\`
- Verify all requirements: \`npx intent-twin verify\`
- Check for drift on modified files: \`npx intent-twin drift\`
- Always ensure \`npx intent-twin drift\` passes before finishing work.
`;
  await writeIfNotExists('CLAUDE.md', claudeMdContent);

  // 3. .agents/skills/intent-twin/SKILL.md
  const skillMdContent = `---
name: intent-twin
description: "Verify product intent contracts, inspect requirements, and detect product drift during AI coding sessions."
---

# IntentTwin Agent Skill

Use this skill to verify whether the codebase still represents the intended product contract.

## Available Commands:
- \`npx intent-twin verify\`: Executes deterministic & behavioral probes for all requirements.
- \`npx intent-twin verify --id <id>\`: Verifies a specific requirement (e.g. \`--id R-001\`).
- \`npx intent-twin drift\`: Checks which requirements were affected by git changes and verifies them.
- \`npx intent-twin infer\`: Scans project files to propose new requirements in \`.intent/product.inferred.yaml\`.

## Verification Semantics:
- **PASS**: All probes executed and passed.
- **FAIL**: Probe assertion failed (evidence stored in \`.intent/evidence/\`).
- **UNKNOWN**: Probes missing or infrastructure unreachable.
`;
  await writeIfNotExists('.agents/skills/intent-twin/SKILL.md', skillMdContent);

  // 4. .cursor/rules/intent-twin.mdc
  const cursorRuleContent = `---
description: IntentTwin Product Contract & Drift Verification Rule
globs: *
---

# IntentTwin Product Contract Rules
- The project contract is defined in \`.intent/product.yaml\`.
- Whenever you modify code, run \`npx intent-twin drift\` to verify that no intended behavior has drifted.
- Never modify \`.intent/product.yaml\` to mask a failure without explicit user approval.
`;
  await writeIfNotExists('.cursor/rules/intent-twin.mdc', cursorRuleContent);

  // 5. .gitignore update
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const gitignoreEntries = ['\n# IntentTwin runtime evidence & drift snapshots', '.intent/evidence/', '.intent/drift/'];
  try {
    const existingGitignore = await fs.readFile(gitignorePath, 'utf8');
    if (!existingGitignore.includes('.intent/evidence/')) {
      await fs.appendFile(gitignorePath, gitignoreEntries.join('\n') + '\n', 'utf8');
      createdFiles.push('.gitignore (updated)');
    }
  } catch {
    // If no .gitignore, create one
    await fs.writeFile(gitignorePath, gitignoreEntries.join('\n').trim() + '\n', 'utf8');
    createdFiles.push('.gitignore');
  }

  return createdFiles;
}

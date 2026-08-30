import fs from 'node:fs/promises';
import path from 'node:path';
import type { VerificationRunSummary } from '../contract/types.js';

export const EVIDENCE_BASE_DIR = '.intent/evidence';

export async function saveEvidence(
  workspaceRoot: string,
  summary: VerificationRunSummary
): Promise<string> {
  const runEvidenceDir = path.join(workspaceRoot, EVIDENCE_BASE_DIR, summary.runId);
  await fs.mkdir(runEvidenceDir, { recursive: true });

  // Write top-level summary.json
  const summaryFilePath = path.join(runEvidenceDir, 'summary.json');
  await fs.writeFile(summaryFilePath, JSON.stringify(summary, null, 2), 'utf8');

  // Write individual item evidence subdirectories
  for (const item of summary.results) {
    const itemDir = path.join(runEvidenceDir, item.id);
    await fs.mkdir(itemDir, { recursive: true });

    const itemResultPath = path.join(itemDir, 'result.json');
    await fs.writeFile(itemResultPath, JSON.stringify(item, null, 2), 'utf8');

    // If there were probe error logs or details, write a clean log file
    const logLines: string[] = [
      `ID: ${item.id}`,
      `Type: ${item.type}`,
      `Title: ${item.title || item.statement}`,
      `Status: ${item.status}`,
      `Duration: ${item.durationMs}ms`,
      '',
      '--- Probes Execution ---',
    ];

    for (const [idx, p] of item.probeResults.entries()) {
      logLines.push(`Probe #${idx + 1} [${p.probe.type}]: ${p.status} (${p.durationMs}ms)`);
      if (p.message) logLines.push(`  Message: ${p.message}`);
      if (p.error) logLines.push(`  Error: ${p.error}`);
      if (p.details) logLines.push(`  Details: ${JSON.stringify(p.details, null, 2)}`);
    }

    await fs.writeFile(path.join(itemDir, 'execution.log'), logLines.join('\n'), 'utf8');
  }

  return runEvidenceDir;
}

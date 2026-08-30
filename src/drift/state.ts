import fs from 'node:fs/promises';
import path from 'node:path';
import type { VerificationRunSummary, VerificationStatus } from '../contract/types.js';

export const DRIFT_STATE_FILE = '.intent/drift/last-verification.json';

export interface SavedVerificationState {
  timestamp: string;
  commitHash?: string;
  runId: string;
  results: Record<string, { status: VerificationStatus; timestamp: string }>;
}

export async function saveVerificationState(
  workspaceRoot: string,
  summary: VerificationRunSummary,
  commitHash?: string
): Promise<void> {
  const filePath = path.join(workspaceRoot, DRIFT_STATE_FILE);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const recordMap: Record<string, { status: VerificationStatus; timestamp: string }> = {};
  for (const r of summary.results) {
    recordMap[r.id] = {
      status: r.status,
      timestamp: summary.timestamp,
    };
  }

  const state: SavedVerificationState = {
    timestamp: summary.timestamp,
    commitHash,
    runId: summary.runId,
    results: recordMap,
  };

  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
}

export async function loadVerificationState(
  workspaceRoot: string
): Promise<SavedVerificationState | null> {
  const filePath = path.join(workspaceRoot, DRIFT_STATE_FILE);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as SavedVerificationState;
  } catch {
    return null;
  }
}

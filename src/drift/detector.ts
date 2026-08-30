import { minimatch } from 'minimatch';
import type {
  ProductContract,
  Requirement,
  Invariant,
  DriftReport,
  RequirementDriftItem,
  DriftStatus,
} from '../contract/types.js';
import { loadContract } from '../contract/parser.js';
import { verifyItem } from '../engine/runner.js';
import { getGitChanges } from './git.js';
import { loadVerificationState } from './state.js';

export function matchFilesToSources(files: string[], sources?: string[]): string[] {
  if (!sources || sources.length === 0) return [];
  const matched: string[] = [];

  for (const file of files) {
    const normalizedFile = file.replace(/\\/g, '/');
    for (const pattern of sources) {
      const normalizedPattern = pattern.replace(/\\/g, '/');
      if (
        normalizedFile === normalizedPattern ||
        normalizedFile.startsWith(normalizedPattern.replace(/\/?\*.*$/, '')) ||
        minimatch(normalizedFile, normalizedPattern, { dot: true })
      ) {
        matched.push(file);
        break;
      }
    }
  }

  return matched;
}

export interface DetectDriftOptions {
  workspaceRoot: string;
  contract?: ProductContract;
  evidenceDir?: string;
}

export async function detectDrift(options: DetectDriftOptions): Promise<DriftReport> {
  const { workspaceRoot } = options;

  const contract = options.contract || (await loadContract(workspaceRoot)).contract;
  const baselineState = await loadVerificationState(workspaceRoot);
  const gitChanges = await getGitChanges(workspaceRoot, baselineState?.commitHash);

  const changedFiles = gitChanges.changedFiles;
  const affectedItems: RequirementDriftItem[] = [];

  let driftCount = 0;
  let stableCount = 0;
  let unverifiedCount = 0;

  const allItems: Array<{ item: Requirement | Invariant; type: 'requirement' | 'invariant' }> = [
    ...contract.requirements.map(req => ({ item: req, type: 'requirement' as const })),
    ...(contract.invariants || []).map(inv => ({ item: inv, type: 'invariant' as const })),
  ];

  for (const { item, type } of allItems) {
    const matchingFiles = matchFilesToSources(changedFiles, item.sources);
    const prevStatus = baselineState?.results[item.id]?.status;

    if (matchingFiles.length > 0) {
      // Re-verify affected requirement or invariant
      const currentResult = await verifyItem(item, type, {
        workspaceRoot,
        evidenceDir: options.evidenceDir,
      });

      let driftStatus: DriftStatus;
      let reason: string;

      if (prevStatus === 'PASS' && currentResult.status === 'FAIL') {
        driftStatus = 'DRIFT_DETECTED';
        reason = `Regression detected: previously PASS, now FAIL after edits to ${matchingFiles.join(', ')}`;
        driftCount++;
      } else if (currentResult.status === 'FAIL') {
        driftStatus = 'DRIFT_DETECTED';
        reason = `Verification failed on modified sources: ${matchingFiles.join(', ')}`;
        driftCount++;
      } else if (currentResult.status === 'PASS') {
        driftStatus = 'STABLE';
        reason = `Verified PASS on modified sources: ${matchingFiles.join(', ')}`;
        stableCount++;
      } else {
        driftStatus = 'UNVERIFIED';
        reason = `Item status UNKNOWN after edits to ${matchingFiles.join(', ')}`;
        unverifiedCount++;
      }

      affectedItems.push({
        id: item.id,
        title: 'title' in item ? item.title : undefined,
        statement: item.statement,
        previousStatus: prevStatus,
        currentStatus: currentResult.status,
        driftStatus,
        affectedByFiles: matchingFiles,
        reason,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    baseCommit: baselineState?.commitHash,
    currentCommit: gitChanges.currentCommit,
    changedFiles,
    affectedRequirements: affectedItems,
    summary: {
      totalAffected: affectedItems.length,
      driftDetected: driftCount,
      stable: stableCount,
      unverified: unverifiedCount,
    },
  };
}

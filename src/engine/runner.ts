import type {
  ProductContract,
  Requirement,
  Invariant,
  Probe,
  ProbeResult,
  ItemVerificationResult,
  VerificationRunSummary,
  VerificationStatus,
} from '../contract/types.js';
import { runFileProbe, runHttpProbe, runExecProbe } from './layer-a-deterministic.js';
import { runBehavioralProbe } from './layer-b-behavioral.js';

export interface VerifyOptions {
  workspaceRoot: string;
  evidenceDir?: string;
  targetId?: string;
}

export async function verifyItem(
  item: Requirement | Invariant,
  type: 'requirement' | 'invariant',
  options: VerifyOptions
): Promise<ItemVerificationResult> {
  const startTime = Date.now();
  const probes = item.probes || [];

  if (probes.length === 0) {
    return {
      id: item.id,
      type,
      title: 'title' in item ? item.title : undefined,
      statement: item.statement,
      critical: 'critical' in item ? item.critical : undefined,
      status: 'UNKNOWN',
      reason: 'No executable probes defined in product contract',
      probeResults: [],
      durationMs: Date.now() - startTime,
    };
  }

  const probeResults: ProbeResult[] = [];
  let finalStatus: VerificationStatus = 'PASS';
  let failureReason: string | undefined;

  for (const probe of probes) {
    let result: ProbeResult;

    if (probe.type === 'file') {
      result = await runFileProbe(probe, options.workspaceRoot);
    } else if (probe.type === 'http') {
      result = await runHttpProbe(probe);
    } else if (probe.type === 'exec') {
      result = await runExecProbe(probe, options.workspaceRoot);
    } else if (probe.type === 'behavioral') {
      result = await runBehavioralProbe(probe, {
        workspaceRoot: options.workspaceRoot,
        evidenceDir: options.evidenceDir,
        requirementId: item.id,
      });
    } else {
      result = {
        probe,
        status: 'UNKNOWN',
        durationMs: 0,
        message: `Unsupported probe type: ${(probe as any).type}`,
      };
    }

    probeResults.push(result);

    if (result.status === 'FAIL') {
      finalStatus = 'FAIL';
      failureReason = result.message || result.error || 'Probe assertion failed';
      // Fast fail for this requirement once an explicit failure is found
      break;
    } else if (result.status === 'UNKNOWN' && finalStatus === 'PASS') {
      finalStatus = 'UNKNOWN';
      failureReason = result.message || result.error || 'Probe could not execute due to environment or unreachable target';
    }
  }

  return {
    id: item.id,
    type,
    title: 'title' in item ? item.title : undefined,
    statement: item.statement,
    critical: 'critical' in item ? item.critical : undefined,
    status: finalStatus,
    reason: failureReason,
    probeResults,
    durationMs: Date.now() - startTime,
  };
}

export async function runVerification(
  contract: ProductContract,
  options: VerifyOptions
): Promise<VerificationRunSummary> {
  const startTime = Date.now();
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  const itemsToVerify: Array<{ item: Requirement | Invariant; type: 'requirement' | 'invariant' }> = [];

  for (const req of contract.requirements) {
    if (!options.targetId || req.id === options.targetId) {
      itemsToVerify.push({ item: req, type: 'requirement' });
    }
  }

  if (contract.invariants) {
    for (const inv of contract.invariants) {
      if (!options.targetId || inv.id === options.targetId) {
        itemsToVerify.push({ item: inv, type: 'invariant' });
      }
    }
  }

  const results: ItemVerificationResult[] = [];
  let passed = 0;
  let failed = 0;
  let unknown = 0;

  for (const { item, type } of itemsToVerify) {
    const itemResult = await verifyItem(item, type, options);
    results.push(itemResult);

    if (itemResult.status === 'PASS') passed++;
    else if (itemResult.status === 'FAIL') failed++;
    else unknown++;
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    total: results.length,
    passed,
    failed,
    unknown,
    results,
  };
}

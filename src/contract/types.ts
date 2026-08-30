export type VerificationStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export type DriftStatus = 'STABLE' | 'DRIFT_DETECTED' | 'UNVERIFIED';

export interface HttpProbe {
  type: 'http';
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  expectStatus?: number;
  expectJsonMatch?: Record<string, any>;
  timeoutMs?: number;
}

export interface FileProbe {
  type: 'file';
  path: string;
  pattern?: string;
  notPattern?: string;
  mustExist?: boolean;
}

export interface BehavioralProbe {
  type: 'behavioral';
  script: string;
  timeoutMs?: number;
}

export interface ExecProbe {
  type: 'exec';
  command: string;
  cwd?: string;
  expectExitCode?: number;
  expectOutputPattern?: string;
  timeoutMs?: number;
}

export type Probe = HttpProbe | FileProbe | BehavioralProbe | ExecProbe;

export interface RequirementProvenance {
  type: 'inferred' | 'manual' | 'verified';
  inferredAt?: string;
  sourceFiles?: string[];
}

export interface Requirement {
  id: string;
  title: string;
  statement: string;
  critical?: boolean;
  provenance?: RequirementProvenance;
  sources?: string[];
  probes?: Probe[];
}

export interface Invariant {
  id: string;
  statement: string;
  sources?: string[];
  probes?: Probe[];
}

export interface ProductContract {
  version: '0.1';
  product: {
    name: string;
    description?: string;
    entrypoint?: string;
  };
  requirements: Requirement[];
  invariants?: Invariant[];
}

export interface ProbeResult {
  probe: Probe;
  status: VerificationStatus;
  durationMs: number;
  message?: string;
  error?: string;
  details?: Record<string, any>;
  screenshotPath?: string;
}

export interface ItemVerificationResult {
  id: string;
  type: 'requirement' | 'invariant';
  title?: string;
  statement: string;
  critical?: boolean;
  status: VerificationStatus;
  reason?: string;
  probeResults: ProbeResult[];
  durationMs: number;
}

export interface VerificationRunSummary {
  runId: string;
  timestamp: string;
  commitHash?: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  unknown: number;
  results: ItemVerificationResult[];
}

export interface RequirementDriftItem {
  id: string;
  title?: string;
  statement: string;
  previousStatus?: VerificationStatus;
  currentStatus: VerificationStatus;
  driftStatus: DriftStatus;
  affectedByFiles: string[];
  reason: string;
}

export interface DriftReport {
  timestamp: string;
  baseCommit?: string;
  currentCommit?: string;
  changedFiles: string[];
  affectedRequirements: RequirementDriftItem[];
  summary: {
    totalAffected: number;
    driftDetected: number;
    stable: number;
    unverified: number;
  };
}

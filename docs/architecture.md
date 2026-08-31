# IntentTwin MVP (v0.1) — Design Specification
 
**Date:** 2026-08-30  
**Status:** Under Review  
**Product Vision:** A free, open-source, local-first Product Contract and verification layer for AI coding agents.

---

## 1. Core Philosophy & Guiding Principles

1. **Setup the least, get the most:** A developer running `intent-twin init` in an existing web app repository should immediately get a working Product Contract and verification capabilities without complex configuration.
2. **Local-first & Free OSS:** 100% functional on the local filesystem. Zero external accounts, cloud servers, databases, or SaaS dependencies.
3. **Workspace-native & Agent-neutral:** IntentTwin lives directly inside the project repo (`.intent/`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.cursor/rules/`). It works across Antigravity, Cursor, Claude Code, and Codex.
4. **Evidence over claims:** Never accept an assertion without deterministic or behavioral proof. `UNKNOWN` is a valid, first-class outcome when proof is insufficient.
5. **Aggressively Minimalist:** Build a tight vertical slice (`init` → `infer` → `verify` → `drift`) without speculative microkernels, browser farms, or UI dashboards.

---

## 2. Repository Structure

IntentTwin is a standalone Node.js/TypeScript CLI tool that can be executed via `npx intent-twin` or installed globally/locally.

```text
IntentTwin/
├── INTENTTWIN_PROJECT_BRIEF.md
├── package.json
├── tsconfig.json
├── bin/
│   └── intent-twin.js              # Executable entrypoint
├── src/
│   ├── index.ts                    # Programmatic API export
│   ├── cli.ts                      # Commander CLI entrypoint & subcommands
│   ├── contract/
│   │   ├── schema.ts               # Zod schema definitions for product.yaml
│   │   ├── parser.ts               # Read/write YAML with validation
│   │   └── types.ts                # TypeScript types derived from Zod
│   ├── engine/
│   │   ├── runner.ts               # Main verification coordinator
│   │   ├── layer-a-deterministic.ts # File checks, HTTP endpoints, JSON schema, process exit codes
│   │   └── layer-b-behavioral.ts   # Targeted Playwright headless probes
│   ├── drift/
│   │   ├── git.ts                  # Git diff inspector & modified files extraction
│   │   └── detector.ts             # Maps changed files to affected requirements
│   ├── infer/
│   │   └── genesis.ts              # Scans repo (package.json, README, routes) to build initial contract
│   ├── evidence/
│   │   └── collector.ts            # Saves run logs, traces, and results to .intent/evidence/run-<id>/
│   └── integrations/
│       └── agent-files.ts          # Generates AGENTS.md, CLAUDE.md, .agents/skills, .cursor/rules
├── templates/
│   ├── product.template.yaml       # Default template for new contracts
│   └── agent-skill.template.md     # Agent skill markdown template
└── test/
    ├── contract.test.ts
    ├── deterministic.test.ts
    ├── drift.test.ts
    └── infer.test.ts
```

---

## 3. Workspace Layout (Target Project Structure)

When IntentTwin is initialized in a user's repository, it generates the following lightweight structure:

```text
user-project/
├── .intent/
│   ├── product.yaml                # The source of truth Product Contract
│   ├── evidence/                   # Local verification runs & test artifacts
│   │   └── run-20260830-130000/
│   │       ├── summary.json
│   │       └── R-001/
│   │           └── probe.log
│   └── drift/                      # Drift state snapshots
│       └── last-verification.json
├── AGENTS.md                       # Instructions for Codex / Antigravity / generic agents
├── CLAUDE.md                       # Instructions for Claude Code
├── .agents/
│   └── skills/
│       └── intent-twin/
│           └── SKILL.md            # Antigravity/Agent skill definition
└── .cursor/
    └── rules/
        └── intent-twin.mdc         # Cursor agent rules
```

---

## 4. MVP Data Model & `product.yaml` Schema

The contract schema is concise, strictly validated using Zod, and human-readable.

```yaml
version: "0.1"
product:
  name: "my-web-app"
  description: "AI-generated SaaS application"
  entrypoint: "http://localhost:3000"

requirements:
  - id: "R-001"
    title: "User Registration"
    statement: "Users can register with valid email and password"
    critical: true
    sources:
      - "src/pages/signup.tsx"
      - "src/api/auth.ts"
    probes:
      - type: "http"
        url: "http://localhost:3000/api/health"
        method: "GET"
        expectStatus: 200
      - type: "file"
        path: "src/pages/signup.tsx"
        pattern: "form"

  - id: "R-002"
    title: "Protected Dashboard"
    statement: "Unauthenticated users are redirected to login"
    critical: true
    sources:
      - "src/middleware/auth.ts"
      - "src/pages/dashboard.tsx"
    probes:
      - type: "behavioral"
        script: |
          await page.goto('http://localhost:3000/dashboard');
          await expect(page).toHaveURL(/.*login.*/);

invariants:
  - id: "I-001"
    statement: "Database credentials must never be exposed to the client bundle"
    sources:
      - ".env"
      - "src/"
    probes:
      - type: "file"
        path: "src/"
        notPattern: "DATABASE_URL"
```

### TypeScript Data Model

```typescript
export type VerificationStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'DRIFT';

export interface HttpProbe {
  type: 'http';
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectStatus?: number;
  expectJsonMatch?: Record<string, any>;
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
  script: string; // JavaScript / Playwright snippet
  timeoutMs?: number;
}

export interface ExecProbe {
  type: 'exec';
  command: string;
  expectExitCode?: number;
}

export type Probe = HttpProbe | FileProbe | BehavioralProbe | ExecProbe;

export interface Requirement {
  id: string;
  title: string;
  statement: string;
  critical?: boolean;
  sources?: string[]; // Glob patterns or file paths
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
```

---

## 5. Command Behavior

### 1. `intent-twin init`
* **Purpose**: Scaffolds `.intent/product.yaml` with standard defaults and generates workspace agent instructions (`AGENTS.md`, `CLAUDE.md`, `.agents/skills/intent-twin/SKILL.md`, `.cursor/rules/intent-twin.mdc`).
* **Flags**:
  * `--force`: Overwrites existing templates if already present.
  * `--minimal`: Skips agent instruction generation.

### 2. `intent-twin infer` (Spec Genesis)
* **Purpose**: Inspects project structure (`package.json`, `README.md`, file trees, API routes, Prisma schemas) and reverse-engineers a candidate `product.yaml`.
* **Output**: Writes or merges inferred requirements with explicit `sources` mappings into `.intent/product.yaml`.

### 3. `intent-twin verify`
* **Purpose**: Executes verification probes for all (or targeted) requirements.
* **Execution Flow**:
  1. Load `.intent/product.yaml`.
  2. For each requirement:
     * Run Layer A probes (File checks, HTTP endpoints, Exec commands).
     * If all Layer A probes pass and behavioral probes exist, run Layer B probes (Headless Playwright).
     * Determine status:
       * `PASS`: All probes executed and passed.
       * `FAIL`: At least one probe explicitly failed (assertion mismatch, non-200 status, error thrown).
       * `UNKNOWN`: No executable probes defined or probes could not reach destination.
  3. Collect evidence into `.intent/evidence/run-<timestamp>/`.
  4. Update `.intent/drift/last-verification.json` with the current commit hash and verification results.
  5. Print concise CLI summary and return exit code (`0` for all pass, `1` if any critical failure).
* **Flags**:
  * `--id <id>`: Verify only a specific requirement (e.g. `--id R-001`).
  * `--json`: Output results in structured JSON.

### 4. `intent-twin drift`
* **Purpose**: Checks for product drift since the last verified commit.
* **Execution Flow**:
  1. Inspect `git diff` against the last verified commit recorded in `.intent/drift/last-verification.json` (or `HEAD~1` / uncommitted changes if none recorded).
  2. Identify list of changed files.
  3. Match changed files against `sources` patterns in `product.yaml`.
  4. Flag affected requirements and execute targeted verification on them.
  5. Output drift report indicating which requirements were broken or impacted.

---

## 6. Verification Flow & Evidence Layout

### Execution & Fallback Rule
```text
For each Requirement:
  ├── Probes defined?
  │     ├── NO  ──> UNKNOWN (No claims made)
  │     └── YES ──> Run Layer A Probes (Deterministic)
  │                   ├── Failed? ──> FAIL (Evidence logged)
  │                   └── Passed?
  │                         ├── Has Layer B Probes (Playwright)?
  │                         │     ├── Run Layer B Probe
  │                         │     ├── Failed? ──> FAIL (Trace/Screenshot logged)
  │                         │     └── Passed? ──> PASS
  │                         └── No Layer B Probes ──> PASS
```

### Evidence Directory Layout
```text
.intent/evidence/run-20260830-134510/
├── summary.json                  # Overall stats, duration, commit hash, counts
├── R-001-user-registration/
│   ├── result.json               # Status: PASS, execution logs, timing
│   └── http-probe.log
└── R-002-protected-dashboard/
    ├── result.json               # Status: FAIL, reason: "Expected redirect to /login but got /dashboard"
    ├── error.log
    ├── trace.zip                 # Playwright trace if applicable
    └── screenshot.png            # Captured failure screenshot
```

---

## 7. Simple & Reliable Drift Algorithm

```typescript
function detectAffectedRequirements(
  changedFiles: string[],
  requirements: Requirement[]
): Requirement[] {
  return requirements.filter(req => {
    if (!req.sources || req.sources.length === 0) return false;
    return req.sources.some(sourcePattern => 
      changedFiles.some(file => minimatch(file, sourcePattern))
    );
  });
}
```

1. **Get Changed Files**: `git diff --name-only <last_verified_commit>` (and uncommitted staged/unstaged changes).
2. **Match Sources**: Fast glob matching between changed files and requirement `sources`.
3. **Targeted Verification**: Run `verify` solely for affected requirements.
4. **Report**:
   * Changed files: 3
   * Affected requirements: 2 (R-002, R-007)
   * Results: R-002 PASS, R-007 FAIL (DRIFT DETECTED!)

---

## 8. Agent Integration Strategy

Agent integration is strictly workspace-native and zero-dependency:

1. **`AGENTS.md` / `CLAUDE.md`**:
   * Clear guidelines for any AI agent working in the repo.
   * Tells the agent to check `.intent/product.yaml` before making changes.
   * Instructs the agent to run `npx intent-twin drift` or `npx intent-twin verify` after making edits to ensure zero product drift.
2. **`.agents/skills/intent-twin/SKILL.md`**:
   * Provides Antigravity / Gemini CLI with the native skill instructions to inspect contracts, run verification, and read evidence.
3. **`.cursor/rules/intent-twin.mdc`**:
   * Cursor rule enforcing contract awareness during edits.

---

## 9. Explicit MVP Non-Goals (Deferred)

The following are explicitly out of scope for v0.1:
- ❌ No cloud backend, hosted database, or user accounts.
- ❌ No web dashboard or visual UI.
- ❌ No mandatory MCP server (can be added later as an optional wrapper).
- ❌ No autonomous crawling or generative test synthesis.
- ❌ No complex graph AST dependency analyzers.
- ❌ No GitHub Action marketplace publisher (handled via simple CLI invocation in CI).

---

## 10. Verification Plan for the MVP

1. **Unit Tests (Vitest)**:
   * Contract parser & Zod schema validation (valid YAML, invalid YAML, missing required fields).
   * Layer A deterministic probes (file matcher, HTTP mock, exec commands).
   * Drift matcher logic (glob matching against changed git files).
   * Infer genesis scanner against sample project fixture.
2. **Integration Verification (End-to-End Fixture)**:
   * Create a sample web app fixture (`test/fixtures/sample-app`).
   * Run `intent-twin init` -> verify generated files.
   * Run `intent-twin infer` -> verify generated `product.yaml`.
   * Run `intent-twin verify` -> verify PASS / FAIL / UNKNOWN statuses and evidence output.
   * Modify a file in `sample-app` -> run `intent-twin drift` -> verify accurate drift detection and targeted re-run.

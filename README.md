# IntentTwin

> **AI can change your code. IntentTwin makes sure it does not silently change your product.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/intenttwin/intent-twin)

IntentTwin is an open-source, local-first **Product Contract and drift verification layer** for software teams working with AI coding agents (Antigravity, Claude Code, Cursor, Codex).

---

## 1. What Problem Does IntentTwin Solve?

When AI coding agents refactor code, fix bugs, or implement features, standard unit tests often pass with green checkmarks even when critical product guarantees are broken:

* **Tenant Isolation (IDOR):** An agent refactors database queries and accidentally drops an organization filter. Unit tests for query formatting still pass.
* **Concurrency & Race Conditions:** An agent replaces atomic row-locking with an in-memory loop. Sequential unit tests pass; concurrent requests double-book resources.
* **Privilege Escalation:** An agent simplifies route middleware and allows non-admin users to cancel transactions.
* **Floating-Point Financial Drift:** An agent converts integer-cent arithmetic (`$19.99 * 3`) to floating-point math, silently introducing rounding errors into billing calculations.

**IntentTwin anchors intended product guarantees in an explicit, executable Product Contract (`.intent/product.yaml`).** When agent-driven changes violate the contract, regressions can be detected immediately before shipping to production.

---

## 2. Before / After Example

### Scenario: AI Agent Refactors Invoice Route

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Standard Unit Tests (Mocks & Isolated Functions)                         │
│    ✓ GET /api/invoices returns valid JSON format                            │
│    ✓ calculateDiscount() handles empty lists                                │
│    Result: ALL 18 TESTS PASS (Developer assumes change is safe)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. IntentTwin Drift Check (Verifying Actual Product Contract)               │
│    ✗ DRIFT  R-010 Tenant IDOR Isolation                                     │
│           Current: FAIL (Previous: PASS)                                    │
│           Files: src/routes/invoices.ts                                     │
│           └─ Regression detected: Tenant B was able to fetch Tenant A data  │
│    Result: 1 DRIFT DETECTED (Regression caught before merge)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Quickstart: Try IntentTwin in a Few Minutes

No global installation required. Run directly in any Node.js project with a Git repository:

### Step 1: Initialize Contract Scaffold
```bash
npx intent-twin init
```
* Scaffolds `.intent/product.yaml` as the explicit source of truth.
* Creates workspace agent instructions (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`).

### Step 2: Infer Candidate Requirements
```bash
npx intent-twin infer
```
* Inspects your repository non-destructively and proposes candidate requirements in `.intent/product.inferred.yaml`.
* Review and apply candidate requirements when ready via `npx intent-twin infer --apply`.

### Step 3: Verify Executable Probes
```bash
npx intent-twin verify
```
* Executes deterministic probes (`http`, `exec`, `file`, `browser`) against application behavior.
* Establishes the verified baseline and saves audit evidence to `.intent/evidence/`.

### Step 4: Detect Product Drift Across Edits
```bash
npx intent-twin drift
```
* Inspects Git changed files against explicit requirement `sources` mappings.
* Re-verifies only affected requirements and flags breaking product regressions.

---

## 4. What Does the Output Look Like?

### `npx intent-twin verify`
```text
[IntentTwin] Verification Summary — docupay-saas
Timestamp: 2026-08-30T07:26:58.069Z | Commit: f05e4c6
Total: 6 | Duration: 42ms

  ✓ PASS  R-010 Tenant IDOR Isolation
  ✓ PASS  R-015 Slot Booking Concurrency Exclusivity
  ✓ PASS  R-020 Admin Role Cancellation Permission
  ✓ PASS  R-025 Exact Integer Cents Pricing
  ✓ PASS  R-030 Invoice PDF Header Formatting
  ✓ PASS  I-005 Soft-deleted invoices must not appear in active totals

Results: 6 PASS  0 FAIL  0 UNKNOWN
Evidence saved to: .intent/evidence/run-2026-08-30T07-26-47
```

### `npx intent-twin drift` (Regression Detected)
```text
[IntentTwin] Product Drift Report
Base Commit: f05e4c6 → Current: f05e4c6 (working tree)
Changed files (1): src/routes/invoices.ts

  ✗ DRIFT  R-010 Tenant IDOR Isolation
         Current: FAIL (Previous: PASS)
         Files: src/routes/invoices.ts
         └─ Regression detected: previously PASS, now FAIL after edits to src/routes/invoices.ts

Drift Summary: 1 DRIFT DETECTED  0 STABLE  0 UNVERIFIED
```

---

## 5. How IntentTwin Works

| Concept | How It Works in IntentTwin |
| :--- | :--- |
| **Source of Truth** | The **Product Contract (`.intent/product.yaml`)** explicitly defines what the product must do. |
| **Strict Verification** | Results evaluate strictly to **`PASS`**, **`FAIL`**, or **`UNKNOWN`** (missing probes or unreachable servers return `UNKNOWN`, never false `PASS`). |
| **Targeted Drift (v0.1)** | Compares Git changed files against explicit requirement `sources` paths to verify affected requirements. |
| **Non-Destructive Inference** | `infer` proposes requirements in `.intent/product.inferred.yaml` without mutating your primary contract. |

---

## 6. Empirical Evaluation (EXP-001)

We evaluated IntentTwin v0.1 against a multi-tenant SaaS application fixture (`docupay-saas`) containing 6 injected regressions and 4 negative controls.

> **Evaluation Context:** These metrics are empirical observations measured on the experimental fixture, not universal mathematical guarantees across all possible software architectures.

### Observed EXP-001 Results:
* **Direct Regression Recall:** **5/5 observed** direct regressions detected on modified source files (IDOR, Concurrency Race, Role Permission, Soft-Delete Summary, and Float Precision).
* **Indirect Regression Recall:** **0/1 observed** detected by targeted drift when modifying an unmapped helper file (`src/utils/format.ts`). *(Documented v0.1 boundary)*
* **Unit Test Escape Rate:** **5/6 observed** regressions completely escaped the fixture's standard unit test suite while unit tests passed.
* **Negative Controls:** **0 false alarms observed** across the 4 controls (documentation update, behavior-preserving refactor, server outage, contract amendment).

To reproduce the benchmark locally:

```bash
git clone https://github.com/intenttwin/intent-twin.git
cd intent-twin
npm install
npm run build
node bin/intent-twin.js benchmark
```

---

## 7. Limitations & What IntentTwin Does Not Guarantee

### What IntentTwin Does Not Guarantee:
1. **Not a Proof of Bug-Free Software:** IntentTwin verifies that application behavior satisfies the assertions written in your Product Contract probes. It cannot verify requirements that have not been specified.
2. **Underspecified Requirements:** If a requirement has no executable probes, verification returns `UNKNOWN` rather than `PASS`.

### Current v0.1 Technical Limitations:
1. **Unmapped Indirect Dependencies:** Targeted `drift` inspects files explicitly mapped in requirement `sources`. If a shared utility (e.g. `src/utils/format.ts`) is modified but not listed in a requirement's `sources`, targeted `drift` will not run that probe. Run full `npx intent-twin verify` in CI pipelines.
2. **Deterministic & Playwright Probes:** Probes execute CLI commands, HTTP checks, file pattern matches, and headless Playwright scripts. Autonomous exploratory web crawling is not included in v0.1.
3. **Local Service Availability:** HTTP probes require either an active local development server or probe scripts that spin up ephemeral test listeners.

---

## 8. The Product Contract Schema (`.intent/product.yaml`)

```yaml
version: "0.1"
product:
  name: "acme-portal"
  description: "Enterprise SaaS platform"
  entrypoint: "http://localhost:3000"

requirements:
  - id: "R-010"
    title: "Tenant IDOR Isolation"
    statement: "Users can only access records belonging to their own organization"
    critical: true
    sources:
      - "src/routes/invoices.ts"
    probes:
      - type: "http"
        method: "GET"
        url: "http://localhost:3000/api/invoices/inv-001"
        headers:
          x-session-token: "token-other-tenant"
        expectStatus: 403

invariants:
  - id: "I-001"
    statement: "No hardcoded API secrets checked into repository"
    sources:
      - "src/"
    probes:
      - type: "file"
        path: "src/"
        notPattern: "SECRET_KEY|DATABASE_URL"
```

---

## 9. Security & Execution Permissions

> **Security Warning:** Product Contracts contain executable probes (`exec`, `http`, `file`, and `browser` probes). Like `package.json` scripts or `Makefile`, probes execute with the permissions of your local developer account. **Only run `verify` or `drift` on trusted Product Contracts.**

* `intent-twin init` automatically adds `.intent/evidence/` and `.intent/drift/` to `.gitignore` to prevent leaking temporary test tokens or logs into version control.
* See [SECURITY.md](SECURITY.md) for the full threat model and reporting guidelines.

---

## 10. Project Status

IntentTwin **v0.1.0** is an early open-source release focused on establishing deterministic Product Contracts and targeted Git drift verification for AI coding workflows. 

**Primary Current Limitation:** Transitive dependency tracking is not yet automated in targeted drift; requirements must list their direct source files, and full `intent-twin verify` should be run in CI.

---

## License

MIT © 2026 IntentTwin Contributors.

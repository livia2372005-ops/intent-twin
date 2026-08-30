# IntentTwin

> **AI can change your code. IntentTwin makes sure it does not silently change your product.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/intenttwin/intent-twin)

IntentTwin is an open-source, local-first **Product Contract and verification layer** for software teams using AI coding agents (Claude Code, Cursor, Copilot, Antigravity, Roo Code, Codex).

---

## 1. What Problem Does IntentTwin Solve?

When AI coding agents refactor code, fix bugs, or add features, standard unit tests often pass with 100% green checkmarks even when critical business behavior is broken:

* **Tenant Isolation (IDOR):** An AI refactors database queries and accidentally drops the `where org_id = user.org_id` filter. Unit tests for query formatting still pass.
* **Concurrency & Race Conditions:** An AI replaces atomic row-locking with an in-memory loop. Sequential unit tests pass; real concurrent requests double-book slots.
* **Privilege Escalation:** An AI simplifies route middleware and allows non-admin users to cancel invoices.
* **Floating-Point Financial Drift:** An AI converts integer-cent arithmetic (`$19.99 * 3`) to IEEE-754 floating-point math, silently introducing rounding discrepancies into billing summaries.

**IntentTwin anchors the true product contract in executable probes** so AI agents cannot accidentally compromise your application's guarantees without triggering an immediate drift warning.

---

## 2. How is IntentTwin Different from Ordinary Tests?

| Aspect | Ordinary Unit / Integration Tests | IntentTwin Product Contract |
| :--- | :--- | :--- |
| **Primary Audience** | Developers writing code | AI agents + human engineering leads |
| **Target of Assertion** | Functions, classes, mocked APIs | End-to-end product promises & invariants |
| **Drift Awareness** | Runs all tests or manually targeted suites | **Inspects Git diffs** and verifies only affected product requirements |
| **Result Semantics** | Binary `PASS` / `FAIL` | **`PASS`**, **`FAIL`**, and **`UNKNOWN`** (never falsely passes on down servers) |
| **Inference (Reverse-Spec)** | Hand-crafted from scratch | Reverse-engineers candidate requirements from existing code (`npx intent-twin infer`) |

---

## 3. Quickstart (Under 2 Minutes)

Zero installation required. Run directly in any Node.js project:

### Step 1: Initialize IntentTwin
Inside your project directory:

```bash
npx intent-twin init
```

This scaffolds:
* `.intent/product.yaml` (Your executable Product Contract)
* `AGENTS.md` / `CLAUDE.md` / Cursor rules (Instructions guiding AI agents to verify intent)

### Step 2: Infer Candidate Requirements
Automatically inspect your codebase:

```bash
npx intent-twin infer
```

This generates `.intent/product.inferred.yaml` non-destructively. Review the proposed statements and apply them when ready:

```bash
npx intent-twin infer --apply
```

### Step 3: Verify Ground Truth

```bash
npx intent-twin verify
```

Saves structured execution evidence to `.intent/evidence/run-<id>/` and establishes your verified baseline.

### Step 4: Detect Product Drift Across Edits

After you or an AI agent modify source files:

```bash
npx intent-twin drift
```

IntentTwin compares current Git changes against requirement sources and verifies only affected product requirements.

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

### `npx intent-twin drift` (When an AI introduces a regression)
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

## 5. The Product Contract Schema (`.intent/product.yaml`)

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

## 6. Empirical Evaluation (EXP-001)

We evaluated IntentTwin v0.1 against a multi-tenant SaaS application fixture (`docupay-saas`) with 6 injected regressions and 4 negative controls.

> **Important Note:** These results represent empirical observations measured on the experimental fixture, not universal guarantees for arbitrary codebases.

### Observed Experiment Results:
* **Direct Regression Recall:** **5/5 (100.0%)** direct regressions detected via targeted drift (IDOR, Concurrency Race, Role Permission, Soft-Delete Billing, and Float Precision).
* **Indirect Regression Recall:** **0/1 (0.0%)** detected by targeted drift when modifying an unmapped transitive file (`src/utils/format.ts`). *(Documented v0.1 boundary)*
* **Unit Test Escape Rate:** **5/6 (83.3%)** regressions completely escaped the fixture's standard unit test suite.
* **False Positive Rate:** **0/4 (0.0%)** false alarms across negative controls (documentation change, behavior-preserving refactor, infrastructure outage, contract amendment).

To reproduce the benchmark locally:

```bash
git clone https://github.com/intenttwin/intent-twin.git
cd intent-twin
npm install
npm run build
node bin/intent-twin.js benchmark
```

---

## 7. Prominent Known Limitations (v0.1)

1. **Indirect Dependency Blind Spot (Unmapped Transitive Files):**
   Targeted `drift` matches files explicitly listed in requirement `sources`. If a requirement watches `src/routes/invoices.ts` and an unmapped utility `src/utils/format.ts` is changed, targeted `drift` will skip that requirement. In CI/CD pipelines, run full `npx intent-twin verify` on main/pull requests.
2. **Deterministic & Playwright Probe Scope:**
   Probes execute deterministic CLI commands, regexes, HTTP checks, and headless Playwright browser scripts. Dynamic autonomous crawling and screenshot visual diffing are not part of v0.1.
3. **Ephemeral Test Servers:**
   HTTP probes require either a running local development server or probe scripts that spin up ephemeral test listeners.

---

## License

MIT © 2026 IntentTwin Contributors.

# IntentTwin 🪞

> **AI can change your code. IntentTwin makes sure it does not silently change your product.**

A free, open-source, local-first **Product Contract & Verification Layer** for AI coding agents (Google Antigravity, Claude Code, Cursor, Codex).

---

## The Problem: Product Drift

When AI coding agents iterate across 20+ turns, refactoring and fixing bugs, tests might still pass and the app might still compile—but **product behavior subtly drifts away from original human intent**.

IntentTwin gives your project a persistent, machine-readable **Product Contract** (`.intent/product.yaml`) that verifies your software against actual behavioral and deterministic expectations.

```text
Human Intent ──> Product Contract ──> Code ──> Runtime Behavior ──> Evidence & Drift Detection
```

---

## Quickstart (Setup the least, get the most)

### 1. Initialize in any repository
```bash
npx intent-twin init
```
Generates `.intent/product.yaml` and workspace-native agent instructions (`AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.cursor/rules/`).

### 2. Infer candidate requirements from existing code
```bash
npx intent-twin infer
```
Non-destructively scans your pages, API endpoints, and structure to generate a reviewable proposal at `.intent/product.inferred.yaml`. Apply when ready:
```bash
npx intent-twin infer --apply
```

### 3. Verify Product Contract
```bash
npx intent-twin verify
```
Runs deterministic and behavioral probes. Outputs clean `PASS`, `FAIL`, or `UNKNOWN` results and saves concrete logs to `.intent/evidence/run-<timestamp>/`.

### 4. Detect Product Drift on Git changes
```bash
npx intent-twin drift
```
Inspects `git diff`, maps modified files to affected contract requirements, and re-verifies them to catch regressions instantly.

---

## Product Contract Example (`.intent/product.yaml`)

```yaml
version: "0.1"
product:
  name: "booking-saas"
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
      - type: "file"
        path: "src/pages/signup.tsx"
        pattern: "<form"

  - id: "R-002"
    title: "Protected Dashboard"
    statement: "Unauthenticated visitors cannot access /dashboard"
    critical: true
    sources:
      - "src/pages/dashboard.tsx"
    probes:
      - type: "behavioral"
        script: |
          await page.goto('http://localhost:3000/dashboard');
          await expect(page).toHaveURL(/.*login.*/);

invariants:
  - id: "I-001"
    statement: "No secrets leaked to client bundle"
    sources:
      - "src/"
    probes:
      - type: "file"
        path: "src/"
        notPattern: "SECRET_KEY|DATABASE_URL"
```

---

## Verification Semantics

IntentTwin enforces rigorous verification truth:
- **No executable probes** &rarr; `UNKNOWN`
- **Any executable probe fails** &rarr; `FAIL`
- **All executable probes pass** &rarr; `PASS`
- **Infrastructure / runtime unreachable** &rarr; `UNKNOWN` (never falsely reports PASS)

---

## Architecture Principles

1. **Local-first**: 100% runs on your machine. Zero cloud backends, logins, or telemetry.
2. **Evidence over claims**: Every result is backed by concrete logs, traces, or screenshots in `.intent/evidence/`.
3. **Agent-neutral**: Works seamlessly across Antigravity, Claude Code, Cursor, and Codex.
4. **Thin client / Fat protocol**: Product Contract belongs to the repository.

---

## License

MIT

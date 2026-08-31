# AI Agent Integrations

IntentTwin integrates natively with AI coding agents to ensure that when agents write or refactor code, they verify their changes against the Product Contract before finishing tasks.

Running `npx intent-twin init` automatically generates workspace instructions tailored for each primary agent environment.

---

## Supported Agent Environments

### 1. Antigravity & Agentic IDEs (`AGENTS.md`)
* Automatically creates `AGENTS.md` in your repository root.
* Instructs agents to check `.intent/product.yaml`, run `npx intent-twin drift` on modified files, and treat `UNKNOWN` as unverified rather than passed.

### 2. Cursor (`.cursor/rules/intent-twin.mdc`)
* Scaffolds Cursor rules defining the ground-truth Product Contract workflow.
* Configures Cursor Agent to run drift checks before marking multi-file refactoring tasks as complete.

### 3. Claude Code (`CLAUDE.md`)
* Automatically adds IntentTwin verification guidelines to `CLAUDE.md`.
* Directs Claude Code to inspect `.intent/evidence/` when probes fail to diagnose root-cause defects.

### 4. Codex & Custom CLI Agents
* Can be invoked directly in pre-commit hooks, CI pipelines, or agent bash loops via:
  ```bash
  npx intent-twin drift --json
  ```
  Returns structured JSON summaries with exit code `0` on stable and `1` on drift detected.

---

## Agent Verification Workflow

```text
┌────────────────────────────────────────────────────────┐
│ 1. Agent Receives Task (e.g. "Refactor database auth") │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Agent Edits Files (e.g. src/routes/invoices.ts)     │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Agent Runs `npx intent-twin drift`                  │
│    Inspects modified sources against Product Contract   │
└────────────────────────────────────────────────────────┘
              │                           │
        (Pass / Stable)           (Drift Detected)
              │                           │
              ▼                           ▼
┌──────────────────────────┐ ┌──────────────────────────┐
│ 4. Task Complete         │ │ 4. Fix Regression        │
│    Product intent intact │ │    Check .intent/evidence│
└──────────────────────────┘ └──────────────────────────┘
```

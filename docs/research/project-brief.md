# IntentTwin — Master Product Brief

## Version 0.1 — Source of Truth for Development

## 1. Product Identity

**Product name:** IntentTwin

**Category:** Open-source Product Intent Verification / Product Contract Layer

**Model:** Free OSS, local-first, workspace-native

**Primary users:** Solo developers, indie hackers, small teams building software with AI coding agents

**Primary agent environments:**

* Google Antigravity
* OpenAI Codex
* Claude Code
* Cursor

**Core promise:**

> AI can change your code. IntentTwin makes sure it does not silently change your product.

---

# 2. Problem

AI coding agents can now make large changes to a repository across many files and many interaction turns.

The problem is no longer only:

> “Does the code compile?”

or:

> “Do the existing tests pass?”

The deeper problem is:

> “Does the software still represent the product the human originally intended?”

Long agentic development sessions can create **Product Drift**.

Example:

```text
Initial product intent
        ↓
AI builds application
        ↓
10 agent interactions
        ↓
20 agent interactions
        ↓
refactoring
        ↓
bug fixing
        ↓
feature additions
        ↓
50 agent interactions
        ↓
Current application
```

The application may still run.

Tests may still pass.

But the current product may no longer match the original intent.

IntentTwin exists to detect this.

---

# 3. Core Concept

IntentTwin creates a **Product Contract**.

The Product Contract is a machine-readable representation of product intent.

It is derived from sources such as:

* initial prompts
* PRDs
* README
* requirements
* agent instructions
* repository structure
* Git history
* optional user-provided documentation

The Product Contract becomes the project's source of truth for product intent.

Core relationship:

```text
Human Intent
     ↓
Product Contract
     ↕
Code
     ↕
Runtime Behavior
```

IntentTwin continuously verifies these relationships.

---

# 4. Product Drift

IntentTwin introduces the concept of:

## Product Drift

Product Drift occurs when the actual implementation or runtime behavior diverges from the intended product contract.

Example:

```text
Requirement:
Customer cannot book an occupied slot.

Implementation:
Looks correct.

Runtime:
Customer can actually book an occupied slot.

Result:
FAIL
```

Another example:

```text
Requirement:
Customer can only see their own invoices.

Code:
Looks plausible.

Runtime:
Customer can access another customer's invoice.

Result:
FAIL
```

IntentTwin is concerned with the **product-level truth**, not merely source-code correctness.

---

# 5. What IntentTwin IS

IntentTwin is:

* a local-first verification layer
* an open-source CLI
* a Product Contract system
* a runtime verification system
* a product drift detection system
* an evidence collection system
* an agent integration layer

---

# 6. What IntentTwin IS NOT

IntentTwin is NOT initially:

* an AI app builder
* a coding agent
* a new IDE
* a replacement for Cursor
* a replacement for Claude Code
* a replacement for Codex
* a generic QA platform
* a full test-management platform
* a project-management system
* a Jira clone
* a cloud browser farm
* an enterprise SaaS
* a multi-agent swarm framework

Do not expand the initial scope into these areas.

---

# 7. MVP Scope

The first version should focus on:

> AI-generated or AI-modified web applications.

Primary technology target:

* JavaScript / TypeScript
* web applications
* Git repositories
* browser-based applications
* Playwright
* local execution

MVP commands:

```bash
intent-twin init
intent-twin infer
intent-twin verify
intent-twin drift
```

Optional later commands:

```bash
intent-twin prove
intent-twin repair
intent-twin export
```

Do not build all future features before the MVP is useful.

---

# 8. UX Principle

The most important UX principle is:

# Setup the least, get the most.

Users should not need to understand:

* MCP
* adapters
* Product Contract internals
* Evidence Graphs
* browser automation
* agent protocols
* cloud architecture

before using IntentTwin.

Desired first experience:

```text
clone/open repository
        ↓
open workspace in AI coding agent
        ↓
IntentTwin detected
        ↓
Create Product Contract?
        ↓
Yes
        ↓
verification becomes available
```

The system should feel like part of the workspace, not another application the developer must manage.

---

# 9. Local-first

IntentTwin must work locally without requiring:

* account
* login
* cloud
* dashboard
* hosted database
* paid subscription
* mandatory API backend

Source code should not need to leave the user's machine.

The local version is the primary product.

Cloud functionality, if introduced later, is optional.

---

# 10. Workspace-native architecture

IntentTwin should live conceptually inside the user's repository.

Expected project artifacts:

```text
project/
├── src/
├── package.json
│
├── .intent/
│   ├── product.yaml
│   ├── requirements/
│   ├── evidence/
│   ├── decisions/
│   └── drift/
│
├── AGENTS.md
├── CLAUDE.md
│
├── .agents/
│   └── skills/
│       └── intent-twin/
│
└── .cursor/
    └── rules/
        └── intent-twin.mdc
```

The exact structure may evolve, but the principle must remain:

> Product Contract belongs to the project. Engine does not have to be copied into the project.

Do not force users to clone a large IntentTwin codebase inside every application.

---

# 11. Thin Client / Fat Protocol

IntentTwin should conceptually use:

```text
Project
  ↓
.intent/
  ↓
IntentTwin engine
  ↓
Git / Playwright / HTTP / runtime probes
```

The project stores:

* intent
* requirements
* evidence
* decisions
* drift history

The engine can be installed or cached separately.

The user should not need a huge embedded dependency tree inside their application repository.

---

# 12. Product Contract

Example:

```yaml
product:
  name: booking-saas

requirements:

  - id: R-001
    actor: customer
    statement: Customer can book an available slot

  - id: R-002
    actor: customer
    statement: Customer cannot book an occupied slot

  - id: R-003
    actor: staff
    statement: Staff can cancel a booking

invariants:

  - id: I-001
    statement: No two customers can own the same slot
```

The schema should be:

* human readable
* machine readable
* deterministic enough to execute verification
* version controlled
* diffable
* portable across AI coding agents

---

# 13. Evidence Graph

Every important requirement should be traceable.

Example:

```text
R-002
Customer cannot book occupied slot
        ↓
Implementation
        ↓
Test
        ↓
Browser trace
        ↓
Screenshot
        ↓
Network evidence
        ↓
Commit
```

A verification result should be explainable.

Avoid opaque outputs like:

```text
AI says this is probably correct.
```

Prefer:

```text
R-002 FAILED

Evidence:
- browser trace
- screenshot
- network request
- relevant source file
- Git commit
```

---

# 14. Verification Model

IntentTwin should use three conceptual verification layers.

## Layer A — Deterministic

Examples:

* HTTP status
* DOM state
* URL
* database state
* JSON schema
* file state
* process exit code
* snapshots

## Layer B — Behavioral

Actually perform user-level actions.

Example:

```text
Open booking page
Select occupied slot
Attempt booking
Observe result
```

## Layer C — Semantic

Use an LLM when needed to:

* interpret ambiguous requirements
* explain failures
* summarize evidence
* suggest fixes

But:

> LLM output must not be treated as the sole source of truth.

The system should prefer deterministic or runtime evidence whenever possible.

---

# 15. Verification States

IntentTwin must support:

```text
PASS
FAIL
UNKNOWN
```

Potential additional state:

```text
DRIFT
```

Definitions:

### PASS

Sufficient evidence confirms the requirement.

### FAIL

Evidence contradicts the requirement.

### UNKNOWN

There is insufficient evidence to conclude.

### DRIFT

A previously valid product behavior or contract relationship changed.

Never convert UNKNOWN into PASS merely because an LLM thinks the feature is probably correct.

---

# 16. Reverse Specification / Spec Genesis

IntentTwin should eventually support:

```text
Existing repository
+
optional live application
+
optional documentation
+
optional agent history
        ↓
Product Contract
```

This lets developers introduce IntentTwin to an existing AI-built application that has no reliable PRD.

However, this must produce more than documentation.

The output must be an **executable Product Contract**.

---

# 17. Agent Integration Strategy

IntentTwin must be agent-neutral.

One Product Contract should work across:

```text
Antigravity
Codex
Claude Code
Cursor
```

Conceptual architecture:

```text
                .intent/product.yaml
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    Antigravity        Cursor          Claude/Codex
        │                │                │
        └────────────────┼────────────────┘
                         ▼
                  IntentTwin Engine
```

Do not make IntentTwin dependent on Claude, Cursor, Codex, or Antigravity.

---

# 18. Agent-specific integrations

Use each environment's native workspace mechanisms where appropriate.

### Antigravity

Use workspace-scoped agent skills and instructions.

Potential locations:

```text
.agents/
AGENTS.md
```

### Cursor

Use workspace rules, skills, hooks, and related workspace mechanisms.

Potential location:

```text
.cursor/
```

### Claude Code

Use:

```text
CLAUDE.md
.claude/
```

### Codex

Use:

```text
AGENTS.md
```

The exact integration implementation may evolve.

The requirement is:

> The agent should naturally understand how to use IntentTwin without the developer manually writing complex setup instructions.

---

# 19. MCP

MCP may be supported.

But MCP must NOT be required for the core product.

Core functionality must remain available through:

```bash
intent-twin verify
```

MCP should be an optional acceleration/integration mechanism for agents.

Potential tools:

```text
intent_twin_get_contract
intent_twin_verify
intent_twin_get_evidence
intent_twin_get_drift
intent_twin_repair
```

Do not make the first release depend on MCP.

---

# 20. Ideal Agent Workflow

Example:

```text
Developer:
"Add coupon support."

Agent:
modifies application

        ↓

IntentTwin detects affected requirements

        ↓

R-007
R-012
R-019

        ↓

IntentTwin verifies only affected areas

        ↓

R-007 ✓
R-012 ✗
R-019 ✓

        ↓

Agent receives evidence for R-012

        ↓

Agent fixes implementation

        ↓

IntentTwin verifies again

        ↓

R-012 ✓
```

IntentTwin should integrate into the agent workflow rather than requiring users to constantly switch applications.

---

# 21. Product Drift Detection

IntentTwin should eventually detect:

```text
Git diff
    ↓
affected requirements
    ↓
targeted verification
    ↓
drift result
```

Do not unnecessarily rerun every check after every change.

The system should become intelligent about which requirements are affected by a code change.

---

# 22. Example CLI UX

Desired:

```text
$ intent-twin verify

Product: booking-saas
Commit: 7e92ad1

Requirements: 32

PASS       25
FAIL        4
UNKNOWN     3

Critical drift:

R-007  Customer cannot book occupied slot
       FAIL

R-012  Staff-only cancellation
       FAIL

R-019  Customer sees only own invoices
       FAIL

Evidence:
.intent/evidence/run-034/
```

CLI output should be:

* clear
* compact
* developer-oriented
* actionable

Avoid marketing language in the CLI.

---

# 23. Git Integration

IntentTwin should understand:

* current commit
* previous commit
* changed files
* affected requirements
* verification history

Potential model:

```text
Requirement
    ↓
Source files
    ↓
Tests/probes
    ↓
Git commits
```

This makes the system useful during iterative AI development.

---

# 24. GitHub Action

A later MVP milestone can provide:

```yaml
- uses: intent-twin/action@v1
  with:
    app_url: https://staging.example.com
    contract: .intent/product.yaml
```

Desired result:

```text
IntentTwin Verification

✓ 41/47 requirements
✗ 3 regressions
⚠ 3 unverified

Release blocked.
```

Do not prioritize this over local development unless it is trivial to implement.

---

# 25. Open-source philosophy

Initial product:

```text
$0
```

No required:

* email
* account
* credit card
* SaaS subscription
* cloud

The OSS version should provide meaningful value by itself.

Potential future paid features may include hosted evidence, collaboration, retention, scheduling, analytics, and enterprise policy.

But:

> Do not design the core architecture around monetization before product usefulness is proven.

---

# 26. Distribution Strategy

Primary acquisition channel:

# GitHub

The product must be easy to:

* install
* clone
* understand
* demo
* fork
* contribute to

The README should communicate the problem in approximately 10 seconds.

Desired positioning:

```text
AI can build your app.

But who checks whether it still built
the product you asked for?

IntentTwin does.
```

---

# 27. Initial users

Primary:

1. Solo developers using AI coding agents
2. Indie hackers
3. AI-first startup founders
4. Small engineering teams

Do not optimize first for enterprise.

---

# 28. Initial supported target

Focus on:

```text
AI-generated / AI-modified web applications
```

Initial stack:

```text
TypeScript
JavaScript
Git
Playwright
local web applications
```

Broader languages/platforms can come later.

---

# 29. Non-goals for MVP

Do not build initially:

* cloud browser infrastructure
* custom LLM
* proprietary model
* IDE
* visual editor
* full SaaS dashboard
* Jira replacement
* full test-management product
* massive multi-agent architecture
* enterprise compliance platform
* mobile-first testing
* distributed execution infrastructure

A smaller working system is more valuable than a broad unfinished platform.

---

# 30. Architecture Principles

The implementation should follow these principles:

### Principle 1

Local-first.

### Principle 2

Agent-neutral.

### Principle 3

Workspace-native.

### Principle 4

Evidence over claims.

### Principle 5

Deterministic checks over LLM judgment whenever possible.

### Principle 6

UNKNOWN is a valid result.

### Principle 7

Incremental verification over full re-verification.

### Principle 8

Git-native and version controlled.

### Principle 9

Human-readable artifacts.

### Principle 10

Minimal setup.

---

# 31. Long-term Vision

IntentTwin should eventually become:

# A portable Product Intent layer for AI-native software development.

Potential architecture:

```text
Human Intent
      ↓
Product Intent IR
      ↓
┌─────┼─────┬──────┐
Cursor Claude Codex Antigravity
└─────┼─────┴──────┘
      ↓
Implementation
      ↓
Runtime
      ↓
Evidence
      ↓
Drift Detection
      ↓
Agent Repair
```

The Product Intent representation should be portable between agents.

The project should not become locked to one AI provider.

---

# 32. Long-term Research Direction

Potential benchmark:

## IntentBench

Each task contains:

```text
initial product intent
+
ambiguous requirements
+
long agent interaction history
+
hidden constraints
+
known injected failures
```

Metrics:

```text
Intent Fidelity
Behavior Fidelity
Requirement Recall
False-PASS Rate
Drift Detection
Cross-Agent Portability
Evidence Completeness
Cost per Verified Requirement
```

False-PASS Rate is especially important.

A product verification system is dangerous if it confidently reports PASS when the product is actually wrong.

---

# 33. Core product thesis

The central thesis of IntentTwin is:

> Increasing coding-agent intelligence is not sufficient to guarantee product correctness.

A product needs a persistent representation of human intent and an independent mechanism for checking whether implementation and runtime behavior still conform to that intent.

IntentTwin therefore focuses on:

```text
Intent
+
Contract
+
Evidence
+
Runtime
+
Drift
```

not simply code generation.

---

# 34. Definition of MVP Success

The MVP is successful when a developer can:

```text
1. Open an existing AI-built web application.
2. Run minimal setup.
3. Generate a Product Contract.
4. Run verification.
5. See concrete PASS / FAIL / UNKNOWN results.
6. Inspect evidence for failures.
7. Make changes with an AI coding agent.
8. Re-run targeted verification.
9. Detect when the product has drifted from its original intent.
```

The developer should not need to learn a complex platform to achieve this.

---

# 35. First Engineering Priority

Do not begin by building:

* dashboard
* cloud
* billing
* marketplace
* complex multi-agent system

Begin by making this experience work extremely well:

```bash
intent-twin init
intent-twin infer
intent-twin verify
intent-twin drift
```

inside a real AI-built web project.

---

# 36. Final Product Definition

IntentTwin is:

> **A free, open-source, local-first Product Contract and verification layer for AI coding agents.**

Its job is to preserve the connection between:

```text
what the human intended
        ↓
what the AI implemented
        ↓
what the application actually does
```

and provide concrete evidence when those three diverge.

---

# Instructions to the Coding Agent

Treat this document as the initial product source of truth.

Do not blindly implement every future idea described here.

First establish a minimal working architecture for the MVP.

Before adding major features, preserve these constraints:

* local-first
* free OSS
* minimal setup
* workspace-native
* agent-neutral
* evidence-driven
* web-app focused
* solo-developer friendly

When making architecture decisions, favor the solution that gives:

> **the least setup for the developer and the most useful verification output.**

Prefer working incremental slices over speculative infrastructure.

When uncertain between a larger architecture and a smaller architecture, choose the smallest architecture that preserves the long-term Product Contract + Evidence + Drift model.

Do not turn IntentTwin into another coding agent.

Do not turn IntentTwin into another generic QA platform.

IntentTwin exists to answer one core question:

> **“Is this software still the product the human intended to build?”**

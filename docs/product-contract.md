# Product Contract Specification (`.intent/product.yaml`)

The **Product Contract** is the explicit source of truth for intended product behavior in an application managed by IntentTwin.

---

## 1. Schema Overview

```yaml
version: "0.1"
product:
  name: "string (required)"
  description: "string (optional)"
  entrypoint: "string (e.g. http://localhost:3000)"

requirements:
  - id: "R-001"
    title: "Human-readable requirement title"
    statement: "Exact behavioral requirement statement"
    critical: true # true | false
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
    statement: "System-wide invariant statement"
    sources:
      - "src/"
    probes:
      - type: "file"
        path: "src/"
        notPattern: "SECRET_KEY|DATABASE_URL"
```

---

## 2. Probe Types

IntentTwin provides deterministic (Layer A) and behavioral (Layer B) probes:

### 1. HTTP Probe (`type: "http"`)
Executes an HTTP request against a local endpoint and asserts response status or JSON properties.
```yaml
probes:
  - type: "http"
    method: "POST"
    url: "http://localhost:3000/api/pricing/calculate"
    headers:
      Content-Type: "application/json"
    body:
      items: [{ name: "Widget", unitPriceCents: 1999, quantity: 3 }]
      vatPercent: 20
    expectStatus: 200
    expectJsonMatch:
      totalCents: 7196
    timeoutMs: 5000
```

### 2. Exec Probe (`type: "exec"`)
Executes a local command or test runner script and asserts exit code or output regex.
```yaml
probes:
  - type: "exec"
    command: "node scripts/probes/check-concurrency.js"
    expectExitCode: 0
    expectOutputPattern: "1 booking succeeded"
    timeoutMs: 10000
```

### 3. File Probe (`type: "file"`)
Asserts existence, non-existence, or content regex patterns across files or directories.
```yaml
probes:
  - type: "file"
    path: "src/"
    pattern: "authMiddleware"
    notPattern: "HARDCODED_API_KEY"
    mustExist: true
```

### 4. Browser Probe (`type: "browser"`)
Executes headless Playwright browser automation steps for UI interaction.
```yaml
probes:
  - type: "browser"
    url: "http://localhost:3000/login"
    steps:
      - action: "fill"
        selector: "input[name='email']"
        value: "user@example.com"
      - action: "click"
        selector: "button[type='submit']"
      - action: "assert_url"
        value: "http://localhost:3000/dashboard"
```

---

## 3. Strict Verification Semantics

IntentTwin enforces three first-class verification states:

* **`PASS`**: All executable probes pass their assertions.
* **`FAIL`**: Any executable probe fails its assertion.
* **`UNKNOWN`**: No executable probes exist for the requirement, or infrastructure is unavailable (e.g. server port closed). Infrastructure errors **never** evaluate to `PASS`.

---

## 4. Targeted Drift Verification

When running `npx intent-twin drift`:
1. Inspects Git changes between the verified baseline commit and the current working tree.
2. Filters out self-generated runtime evidence (`.intent/evidence/`, `.intent/drift/`).
3. Maps modified files against requirement `sources`.
4. Re-verifies only the affected requirements, isolating product regressions in milliseconds.

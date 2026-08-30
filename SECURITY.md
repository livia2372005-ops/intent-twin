# Security & Safety Policy — IntentTwin

IntentTwin is a developer tool designed to verify product contracts and detect behavioral drift in local workspaces and CI pipelines.

## Threat Model & Execution Boundaries

### 1. Product Contract Execution
* **Nature:** `.intent/product.yaml` contains executable verification probes (`exec`, `http`, `file`, and `browser` probes).
* **Security Context:** Similar to `package.json` scripts, `Makefile`, or `docker-compose.yml`, the Product Contract is considered **code**. Executing `intent-twin verify` or `intent-twin drift` runs the commands defined in the contract with the permissions of the current user.
* **Guideline:** Do not run `intent-twin verify` on untrusted repositories without reviewing `.intent/product.yaml` first.

### 2. Network & Probe Boundaries
* **Layer A (HTTP Probes):** Probes default to `localhost` and local dev server ports. They include explicit timeouts (default 5000ms) to prevent hanging processes.
* **Layer B (Browser Probes):** Playwright browser automation is configured to run headless and interact exclusively with local application entrypoints.

### 3. Evidence Logs & Sensitive Data
* Evidence runs are recorded under `.intent/evidence/` for inspection and agent auditing.
* By default, `intent-twin init` automatically registers `.intent/evidence/` and `.intent/drift/` in `.gitignore` to prevent leaking temporary logs, test tokens, or environment payloads into version control.

### 4. Reporting Security Issues
If you discover a security vulnerability or exploit vector within IntentTwin itself, please submit a report via GitHub Security Advisories or email the maintainers directly.

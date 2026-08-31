# Release & npm Publishing Guide

IntentTwin uses **GitHub Actions + npm Trusted Publishing (OIDC)** for automated, zero-credential releases with cryptographic build provenance.

---

## 1. Release Architecture

```text
git tag v0.1.x
      ↓
GitHub Actions (release.yml)
      ↓ (OIDC Token)
npm Trusted Publishing / Provenance
      ↓
npm registry (intent-twin)
```

* **No long-lived npm tokens stored in repository secrets.**
* **Cryptographic provenance (Sigstore/SLSA) attached to every build.**
* **Strict automated gate:** Releases fail automatically if tests, typechecks, or build validations fail.

---

## 2. Setting Up npm Trusted Publishing (OIDC)

To link GitHub Actions to npm:

1. Log into your npm account at [npmjs.com](https://www.npmjs.com).
2. Go to **Account Settings** $\rightarrow$ **Publishing Access** (or package settings at `https://www.npmjs.com/package/intent-twin/access` once created).
3. Under **Trusted Publishers**, click **Add a publisher** $\rightarrow$ select **GitHub Actions**.
4. Fill in the repository coordinates:
   - **Repository Owner:** `livia2372005-ops`
   - **Repository Name:** `intent-twin`
   - **Workflow filename:** `release.yml`
   - **Environment:** *(Leave blank unless using GitHub Environments)*
5. Click **Save Publisher**.

---

## 3. One-Time Bootstrap Note

If the package `intent-twin` has not been published to npm yet:
* npm requires either configuring Trusted Publishing across your account/org namespace **OR** performing a one-time bootstrap publish with your interactive npm session.
* Once the package entry exists on npm, the GitHub Actions OIDC workflow automatically manages all subsequent releases (`v0.1.1`, `v0.2.0`, etc.) without manual 2FA or tokens.

---

## 4. Standard Release Workflow

For all future releases:

```bash
# 1. Bump version and create Git tag
npm version patch   # or minor / major

# 2. Push commits and tags to GitHub
git push origin main
git push origin --tags
```

GitHub Actions will automatically run the test suite, build artifacts, verify the package tarball, and publish to npm with SLSA provenance.

---

## 5. Verifying the Published Package

```bash
# Inspect npm registry entry
npm view intent-twin

# Verify CLI globally via npx
npx intent-twin --help
```

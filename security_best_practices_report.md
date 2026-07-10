# Craftory Security Best-Practices Report

## Executive Summary

No critical vulnerabilities were found in this pass. The previous high Fastify dependency finding has been fixed by upgrading Fastify and its official plugin family to Fastify 5-compatible releases. `npm audit --json` now reports zero vulnerabilities. I also fixed two app-level hardening issues during the review: permissive prefix-based CORS origin matching and blanket proxy trust.

## High Severity

### SEC-001: Fastify dependency had active advisories

- Rule ID: DEP-AUDIT-001
- Severity: High, fixed
- Location: `backend/package.json:27`
- Evidence: `npm audit --json` reports `fastify` with GHSA advisories:
  - `GHSA-jx2c-rxcm-jvmq`: Content-Type tab character can bypass body validation.
  - `GHSA-444r-cwp2-x5xf`: `request.protocol` / `request.host` spoofing through forwarded headers.
  - `GHSA-mrq3-vjjr-p77c`: DoS via unbounded memory allocation in `sendWebStream`.
- Impact: Attackers may bypass request body validation in affected Fastify versions; forwarded-header spoofing can affect apps that trust proxy headers; DoS impact depends on route behavior.
- Fix applied: Upgraded Fastify to `^5.8.5` and official Fastify plugins to compatible current releases.
- Mitigation: I also changed `trustProxy` to opt-in via env in `backend/src/server.js:52`, reducing exposure to forwarded-header spoofing even after the package upgrade.
- False positive notes: Re-run `npm audit --json` after future dependency changes.

## Medium Severity

### SEC-002: CSP allows inline scripts and styles

- Rule ID: JS-XSS-CSP-001
- Severity: Medium
- Location: `docker/nginx.conf:30`
- Evidence: `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`.
- Impact: If any DOM XSS bug exists, inline script execution is easier because CSP does not block inline JavaScript. The static frontend currently relies heavily on inline scripts, so this cannot be removed without a frontend refactor.
- Fix: Move inline page scripts/styles into external files and replace `unsafe-inline` with nonce or hash based CSP.
- Mitigation: The frontend generally escapes API/user strings before injecting them, and blog rich content is sanitized server-side before rendering.
- False positive notes: This is an architectural tradeoff in the current static HTML structure, not a newly introduced regression.

## Fixed During This Pass

### SEC-003: Prefix-based CORS origin matching

- Rule ID: EXPRESS-CORS-001
- Severity: Medium
- Location: `backend/src/server.js:62-70`
- Previous issue: The old `origin.startsWith(allowedOrigin)` check could allow origins like `https://craftory.io.vn.evil.example`.
- Fix applied: CORS now parses the request origin and requires exact origin equality.

### SEC-004: Blanket proxy trust

- Rule ID: EXPRESS-PROXY-001
- Severity: Medium
- Location: `backend/src/server.js:50-52`
- Previous issue: `trustProxy: true` trusts all `X-Forwarded-*` values if a deployment path does not sanitize them.
- Fix applied: Proxy trust is now disabled by default and only enabled when `TRUST_PROXY=true`.

### SEC-005: Transitive `fast-uri` advisories

- Rule ID: DEP-AUDIT-001
- Severity: High, fixed
- Location: `backend/package.json:37-39`
- Previous issue: `npm audit` initially reported 5 high findings, including vulnerable `fast-uri` through `@fastify/ajv-compiler` and `fast-json-stringify`.
- Fix applied: Added npm override for `fast-uri@^4.0.0`; the subsequent Fastify 5 upgrade removed the remaining direct Fastify finding.

## Verification Performed

- `node --check src/routes/orders.js`
- `node --check src/server.js`
- `node node_modules/prisma/build/index.js validate`
- `npm audit --json`
- Searched for high-signal frontend sinks (`innerHTML`, `eval`, `document.write`, string timers).
- Searched backend state-changing routes for CSRF/auth coverage.

## Residual Risk

No package vulnerabilities remain in the current `npm audit` output. The frontend CSP still allows inline scripts/styles because the current static pages rely on inline JavaScript and CSS; tightening this requires a frontend asset refactor.

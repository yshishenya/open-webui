- [ ] **[FEATURE][MAIL]** Explicit product email consent and unsubscribe
  - Spec: meta/memory_bank/specs/work_items/2026-10-02__feature__product-email-preferences.md
  - Owner: Codex
  - Started: 2026-10-02
  - Summary: Separate optional product consent from legal acceptance; bind permission to verified current address, shared welcome guard, account settings and public unsubscribe.
  - Risks: Privacy, address trust, concurrent withdrawal and SMTP timing; additive migration and guarded release required.

### 2026-10-02 implementation and verification

- Server-owned product consent, audit history and per-message hashed unsubscribe links implemented. Signup starts unchecked; social/existing accounts choose in account settings. Common address updates revoke trust and consent; stale verification tokens are rejected. Product SMTP is disabled by default until queue/pilot readiness; service mail remains independent.
- Shared guard rechecks after SMTP connection/AUTH before every submission, including retry. Public manual unsubscribe uses a fragment and explicit POST; RFC8058 uses separate exact-form POST. Application access log redaction and audit exclusion protect link secrets.
- SQLite full backend: 472 passed, 1 PostgreSQL-only test skipped. PostgreSQL policy/concurrency: 50 passed. Restored-copy upgrade reaches e1c020261002; all preference tables empty after migration.
- Frontend: 147 tests passed. Typecheck has identical 8360 baseline/current errors and 224 warnings; zero added or removed diagnostics. Ruff comparison has zero new findings. Existing frontend ESLint crashes in both baseline/current with the same no-unused-vars failure; no dependency upgrade in this work item.
- Docker build hit Node heap limits at default/4096 MiB. Native build uses verified official Node 22.23.3 and 8192 MiB heap, existing lockfile and public counter setting. Native build succeeds; 16 browser scenarios pass. Proxy privacy, DKIM, exact-SHA CI and release acceptance remain pending.

Spec: meta/memory_bank/specs/work_items/2026-10-02__feature__product-email-preferences.md

### Source freeze

- Final backend: 472 passed / 1 PostgreSQL-only skip; PostgreSQL/SMTP: 50 passed. Five new Python files pass Ruff/Black. Native production build and 16 browser scenarios passed. Safe fallback passes 27 service SMTP tests and blocks welcome. Proxy redaction handles both raw and encoded routes with zero synthetic-token leaks. Exact-SHA CI and application release acceptance remain pending.

Spec: meta/memory_bank/specs/work_items/2026-10-02__feature__product-email-preferences.md

- Final address review: Unicode and ASCII encodings of the same domain share a canonical fingerprint, so suppression cannot be bypassed by changing spelling. Regression passes in both database suites.

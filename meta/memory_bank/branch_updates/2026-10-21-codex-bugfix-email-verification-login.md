- [ ] **[BUG][AUTH]** Confirm email and sign in in one click
  - Spec: `meta/memory_bank/specs/work_items/2026-10-21__bugfix__email-verification-login.md`
  - Owner: Codex
  - Branch: `codex/bugfix/email-verification-login`
  - Started: 2026-10-21
  - Summary: Receipt confirmed by owner; current callback only verifies and asks for password. Implement one-use session exchange; investigate observed password failures without changing user credentials.
  - Tests: full backend 1297 passed/10 skipped; focused 46 passed/1 skipped; PostgreSQL 24 passed; focused browser-script/API 4 passed; no new Ruff diagnostics. Full frontend/build/browser release pending.
  - Risks: Authentication token consumption, concurrency and current-address checks; real personal password remains unverified.

- Follow-up: compiled Firefox acceptance exposed a cancelled background getVersion request in the shared root socket callback. Add the existing null-fallback pattern; forced interruption regression fails on the original compiled code in both browsers. Preserve independently merged legal geometry and email-signin-first work.
  - Spec: `meta/memory_bank/specs/work_items/2026-10-21__bugfix__email-verification-login.md`
  - Remaining: complete changed frontend checks/build, compiled regression, exact-head CI and guarded production release; personal password recovery remains open.

- [x] **[BUG][AUTH]** Confirmation signs in once; exact-source production release accepted on 2026-10-22.
  - Spec: `meta/memory_bank/specs/work_items/2026-10-21__bugfix__email-verification-login.md`
  - Owner: Codex
  - Branch: `codex/bugfix/email-verification-login`
  - Source: `49ed6bf79b9c825a8b24fae7b616b71ba2fed04b`, PR379 merged; final runtime healthy, zero restarts.
  - Tests: backend 1297 passed/10 skipped; PostgreSQL 24 passed; final frontend 2614 passed, type/lint/build green, final compiled Chromium/Firefox 4/4. Forced version-interruption regression reproduced before and passes after.
  - Production: hard migration passed, verified backup/rollback retained, immutable files/public assets matched; money, mounts, settings and 12 core neighbors preserved.
  - [ ] Personal password recovery/acceptance: owner must use normal recovery; cause unconfirmed, credentials untouched. Overall work item and linked SDD remain in progress.

- [ ] **[BUG][MAIL]** Owner reset email delayed by Mailu to Proton connectivity.
  - Spec: `meta/memory_bank/specs/work_items/2026-10-21__bugfix__email-verification-login.md`
  - Owner: Codex
  - Branch: `codex/bugfix/email-verification-login`
  - Evidence: actual request HTTP200, unused two-hour token metadata, local SMTP accepted, explicit deferred4.4.1 TCP25 timeouts. Two Proton IPv4 later reachable; one scoped retry of the same queue ID requested. No duplicate, credentials/consent/configuration change.
  - Pending: actual recipient acceptance/owner receipt and normal recovery; no claim of stable delivery.

- [x] Owner-requested comparison: one recovery email to `yan@shishenya.ru`, accepted by Yandex in2.8s (250/statussent); Inbox unconfirmed, password unchanged. Proton remains deferred. No application/configuration change.
  - Spec: `meta/memory_bank/specs/work_items/2026-10-21__bugfix__email-verification-login.md`
  - Owner: Codex
  - Branch: `codex/bugfix/email-verification-login`

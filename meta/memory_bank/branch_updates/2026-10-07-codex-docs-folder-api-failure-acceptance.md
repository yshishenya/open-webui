- [x] **[DOCS][BUG][CHAT]** Record accepted folder API fix
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__folder-api-failure-contract.md`
  - Owner: Codex
  - Branch: `codex/docs/folder-api-failure-acceptance`
  - Summary: Complete SDD and record exact-source browser, CI and production proof for PR347; keep global quality/business gates open.
  - Done: 2026-10-07
  - Tests: SDD policy, scoped documentation format and diff checks. Runtime acceptance remains bound to c1dd2c95dc, not the docs commit.

## Final acceptance — 2026-10-07

PR347: https://github.com/yshishenya/open-webui/pull/347. Accepted source `c1dd2c95dc23ae3c5b2dc8df599b9467de0dceaa`, merge `ed5cd44beba4e56e2e9e7838b2a7d553471d056f`; trees equal. Applicable CI passed; dependency-review skipped, CodeRabbit reported review skipped. Runtime-identical source binding proves 883/883 frontend tests and 15/15 folder regressions. Full checks still report 3004 type errors / 118 warnings and 1127 lint errors, with zero new diagnostics.

Compiled acceptance: Chromium 33/33 and Firefox at 390px 33/33, total 66, zero failures/errors/skips. Two global setup executions excluded from 66. Separate disposable databases, unchanged sign-in limiter. The original browser failures and failed build attempts are retained as historical evidence.

Production release `20261007T112730Z-folder-failures-c1dd2c95dc-20261007` accepted: exact frontend source, 4915 frontend / 427 Python file hashes match; healthy, restarts 0; environment, compose, mounts, 12 neighboring containers and monetary snapshot preserved (DML 0). Published digest `sha256:9c91fd670bb643718d8b68e40d70f8fa2da2e2f5dbfded9f17c061dc2138c1f9`; backend remains `6a2b5394518d4ac5bfc7e64039cc4db934a66107`. Image pinned in production .env without another container recreation. Public health/version/env/guide return 200; guide has three nonempty preset links and support address. Backup checked; rollback image retained; free disk above 10 GiB guard. No server backup deleted during this release.

SDD completed 3/3. Evidence is private: revision-c1dd2c95dc/release-acceptance.json and its hash-bound references. This closes the folder defect only. Plan remains 198/244, 46 numbered items open; new numbered closures 0. G14/13.11/13.16, global backend/type/lint gates and real external/human/calendar criteria remain open. Browser width is not physical-phone acceptance; public guide smoke is not independent usefulness or a new payment.

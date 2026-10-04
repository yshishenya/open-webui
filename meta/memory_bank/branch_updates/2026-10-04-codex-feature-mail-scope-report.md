- [x] **[FEATURE][MAIL]** Report declared observation population with explicit coverage
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__feature__mail-scope-report.md`
  - Owner: Codex
  - Branch: `codex/feature/mail-scope-report`
  - Started: 2026-10-04
  - Summary: Reuse existing journal/queue to expose six typed aggregate rows, exact observed denominators and explicit incomplete/unavailable states; preserve legacy unknown history and disabled transport.
  - Tests: Contract/investigation in progress. SQLite/PostgreSQL, read-only authorization/privacy and exact-image/production gates planned.
  - Risks: False completeness, payment/account unit mismatch, lost links and historical reconstruction. Overall189/244 and real pilot remain open.

- 2026-10-04: Implementation and47SQLite/47PostgreSQL scope-report cases passed; real concurrent snapshots stable, read-only/privacy/caps checked. Full source checks and image/CI/production acceptance are in progress. Final goal and189/244 remain open.

- 2026-10-04: Full backend885passed/4PostgreSQL-onlyskips;205+75 isolated PostgreSQL passed, dedicated consent/success check still running. Frontend251/51passed; broad4419/177 type findings and1540ESLint unchanged. Five touched backend files Black/Ruff clean. Report release pending; transport off.

- Done: 2026-10-04. PR213/sourceb3c377cfe/mergeac10f64a3/digesta744b6f64c0e accepted; exact885backend/330PostgreSQL,9liveHTTPS,4904/499filehashes and money/consent/queue/journal preservation verified. Technical reporting complete; voluntary pilot and overall goal remain active.

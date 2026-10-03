- [x] **[FEATURE]** Bounded complete-population mail observation runner.
  - Spec: meta/memory_bank/specs/work_items/2026-10-03__feature__mail-observation-runner.md
  - Owner: Codex
  - Done: 2026-10-03
  - Summary: Observe all declared members using the shared business rule; keep dispatch disconnected and source/coverage loss visible. Future payment source windows are declared before later actual payments arrive.
  - Tests: final full backend776passed/4PostgreSQL-only skips; actual PostgreSQL63passed; changed-fileBlack/Ruff and SDD0errors/0warnings.
  - Risks: Journal-only writes; no transport or money changes. Reporting and volunteer pilot remain pending.

  - Production: PR205/source95f17e9ed/merge4ce4825c5 accepted; frozen backend776/4skips/PostgreSQL149;5759frontend/484backend hashes;14neighbors;77schemas/sourcefingerprints preserved; health200/restarts0. Diagnostic139members/870scenarios/two6pagepasses/0duplicates/0transport.0ready recipients; volunteer pilot, administrative controls and dispatch/report integration remain open. CodeRabbit review skipped; no independent review claimed.

- [ ] **[FEATURE]** Administrative controls for diagnostic mail observations.
  - Spec: meta/memory_bank/specs/work_items/2026-10-03__feature__mail-observation-admin-controls.md
  - Owner: Codex
  - Started: 2026-10-03
  - Summary: Make bounded scope creation, page traversal and closure usable by administrators; retain explicit diagnostic purpose, durable request replay and unavailable coverage. Resolve identical-owner HTTP concurrency before exposing the internal runner.
  - Tests: pending; no runtime code changed.
  - Risks: New idempotency metadata needs design/migration proof; keep consent, payments, queue and SMTP untouched. Volunteer dispatch and report denominators remain separate.

- [ ] **[FEATURE]** Safe repeated pages and scope closure.
  - Spec: meta/memory_bank/specs/work_items/2026-10-03__feature__mail-observation-admin-controls.md
  - Owner: Codex
  - Started: 2026-10-03
  - Summary: Implemented scope/run locking before source reads, expected cursor conflicts without failing a healthy run, cursor-guarded failure recording and repeatable history-preserving closure. Administrative HTTP/UI remain pending verification.
  - Tests: Docker Compose SQLite and real PostgreSQL regression pack in progress.

- [ ] **[FEATURE]** Administrative API/UI implementation verified locally.
  - Spec: meta/memory_bank/specs/work_items/2026-10-03__feature__mail-observation-admin-controls.md
  - Owner: Codex
  - Started: 2026-10-03
  - Summary: Added durable actor-bound declaration/start receipts, authenticated content-free diagnostic endpoints, sequential administrator UI with uncertainty recovery and additive migration preserving old observation tables.
  - Tests: Full backend809passed/4PostgreSQL-only skips; page/store PostgreSQL68passed; administrative commands19passed on both engines; mounted UI/controller15passed. Final migration/PostgreSQL, frontend build and CI/release remain pending. Typecheck retains existing4419errors/177warnings,0new-file errors.
  - Risks: Publication needs a rebuilt frontend; no production or pilot acceptance claimed. Consent/account/payment/queue configuration stays untouched.

- [ ] **[FEATURE]** Final local verification on2026-10-04.
  - Spec: meta/memory_bank/specs/work_items/2026-10-03__feature__mail-observation-admin-controls.md
  - Owner: Codex
  - Started: 2026-10-03
  - Summary: Full backend810passed/4skips, actual PostgreSQL97passed, frontend251passed. SDD validates0/0. Production release and candidate/CI acceptance are still pending; overall onboarding goal remains active.

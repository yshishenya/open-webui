- [ ] **[FEATURE][ACTIVATION]** Durable foreground completion journal
  - Spec: meta/memory_bank/specs/work_items/2026-10-02**feature**foreground-success.md
  - Owner: Codex
  - Started: 2026-10-02
  - Summary: Record completed visible foreground operations once; exclude errors/internal calls, keep server-only saved checkpoints and bounded recovery.
  - Risks: Success semantics, stream termination, concurrency, source trust and migration compatibility.

### Local implementation and verification

- Content-free success journal and trusted pending checkpoints implemented; one request UUID across model fanout, server terminal guards and independent bounded recovery. No historical message inference or new dependency.
- Backend 514 pass, two PostgreSQL-only skips covered by 93 passing PostgreSQL/SMTP checks; frontend 147 pass; migrations upgrade/downgrade/reupgrade on SQLite and restored PostgreSQL structure pass. New source files Ruff/Black clean; global Ruff has zero added diagnostics. Typecheck baseline/current identical 8360 errors and 224 warnings.
- Frozen-source CI, rollback and production acceptance remain pending; product mail remains disabled.

Spec: meta/memory_bank/specs/work_items/2026-10-02**feature**foreground-success.md

- [x] **[FEATURE][ACTIVATION]** Durable foreground completion journal
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__foreground-success.md`
  - Owner: Codex
  - Done: 2026-10-02
  - Summary: Record completed visible foreground operations once; exclude errors/internal calls, keep server-only saved checkpoints and bounded recovery.
  - Risks: Success semantics, stream termination, concurrency, source trust and migration compatibility.

### Local implementation and verification

- Content-free success journal and trusted pending checkpoints implemented; one request UUID across model fanout, server terminal guards and independent bounded recovery. No historical message inference or new dependency.
- Backend 520 pass, two PostgreSQL-only skips covered by 99 passing PostgreSQL/SMTP checks; frontend 147 pass; migrations upgrade/downgrade/reupgrade on SQLite and restored PostgreSQL structure pass. New source files Ruff/Black clean; global Ruff has zero added diagnostics. Typecheck baseline/current identical 8360 errors and 224 warnings.
- PR139 merged; frozen945064550 source and production acceptance completed. Compatible rollback retains s1c020261002. Product mail remains disabled.

Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__foreground-success.md`

- Review correction: HTTP error streams are excluded in both emitter/API paths; six additional handler cases pass. Compose backend: 520 pass / two PostgreSQL-only skips. CI Ruff baseline 182/current181, zero new findings.

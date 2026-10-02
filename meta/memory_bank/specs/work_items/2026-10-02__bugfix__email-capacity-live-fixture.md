# Isolate mail regression fixtures from runtime configuration and elapsed setup

Status: Done
Owner: Codex
Branch: `codex/bugfix/email-capacity-live-fixture`

## Reproduced causes and scope

The daily-capacity restart test reserved a synthetic SMTP host/user/port25 key but inherited the runtime port for the fresh sender. The isolated test therefore used a different counter when run inside the released image. Pin the synthetic port alongside the existing synthetic host/user.

The credited-notice priority test captured a claim timestamp before several asynchronous reconciliations. On PostgreSQL, setup could cross a second; the new service job was not due at the stale timestamp, so an older optional job was claimed. Claim using the current time after setup, as the worker does.

These are two test-only changes in the existing queue suite. No runtime, provider, schema, dependency or real message changes. Record daily-capacity release acceptance and complete its existing SDD separately.

## Acceptance

- [x] Existing queue suite passes on isolated SQLite and PostgreSQL.
- [x] Full backend suite and touched-file format/lint pass.
- [x] Runtime/config diff from the released source is empty; no image redeployment needed.
- [x] Public acceptance and completed daily-capacity SDD contain verified source/image/live checks without private operational data.

## Upstream impact

None. Fork-owned tests and documentation only.

## Verification

Compose full backend613 passed/3 PostgreSQL-only skips; PostgreSQL queue33 passed; isolated released-container queue32 passed/1 skip with synthetic port pinned. Black passed; Ruff/schema/format and required CI are checked before merge. No runtime or configuration files changed.

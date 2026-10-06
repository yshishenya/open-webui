# Admin model persistence recovery

## Meta
- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/admin-model-save-recovery
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-admin-model-save-recovery-2026-10-06-001.json

## Context
Actual admin upsert and inline editor callback swallow rejected create/update requests, close the editor, and reload over unsaved fields. Every shared caller was traced: four batches, individual visibility, and editor submit. The separate optimistic enabled switch also swallows a failed create. API clients can return null on transport errors; null must not count as successful persistence.

## Goal / Acceptance Criteria
- [x] Rejected and null create/update preserve editor identity, name, description, instructions and retry; exactly one error and zero success notifications.
- [x] Successful retry persists and closes the editor; helper performs no premature reload that unmounts it.
- [x] Four batch actions wait for every mutation before refreshing; partial failure produces one error and zero unconditional success messages; local values reflect authoritative persisted state.
- [x] Individual visibility failure leaves local values unchanged; enabled-switch failure restores its previous value and reports an error.
- [x] Actual handler checks fail before and pass after; compiled admin refusal/retry cases pass in Chromium and Firefox.
- [x] Docker frontend suite passes; changed component lint passes and mapped diagnostics introduce zero errors.
- [x] Exact source CI and merge tree accepted; immutable frontend overlay from the current production digest passes guarded backup/Alembic/CAS/health/env/byte checks.

## Scope
Only admin Models.svelte behavior and meaningful regression checks. Existing API, data schema, translations and dependencies retained. Shared ModelEditor already catches thrown parent failures. Errors propagate from the mutation helper; user-action boundaries report them. Promise.allSettled waits for all batch responses and refreshes persisted state after mixed results. No new API, provider calls or permission changes.

## Upstream impact
src/lib/components/admin/Settings/Models.svelte owns the state and all affected handlers, with no existing extension point for these outcomes. Remove swallowed failures and premature optimistic changes there. Keep surrounding markup and unrelated behavior intact; only mandatory changed-file lint cleanup is allowed and verified separately.

## Verification
Docker Compose frontend Vitest, check and lint; actual extracted component handlers; compiled browser tests using isolated fixture/API interception. Frontend-only scope requires no backend code changes. CI read through Code Review connector only. Existing production digest is refreshed before packaging/release; retained rollback and verified backup required.

## Risks / Rollback
Partial batch persistence is possible: finish all requests, show one error and reload authoritative state. Preserve production backend/env/static assets/neighbors. Rollback is the previously accepted immutable image. Full onboarding goal and all external acceptance remain active; this fix alone closes no numbered plan item.

## Accepted results — 2026-10-06

PR289 source `116e1c02d49db07a9b8440ea9c7a59019c6c6599`, merge `82240c401682c4c7db4129def26a5712ec638103`. Source, precomputed and merged trees equal `dc67d400e7db87a640c89ae0c2354ae5bf8c4198`. Thirteen successful CI check runs (including repeated base-policy checks), one expected dependency-review skip. CodeRabbit review disabled for the base branch; no independent review claimed.

Actual handlers:14/14; before fix11/13fail and2expected pass. Docker frontend602/602; compiled create/update refusal-and-retry4/4 in Chromium and Firefox390px, including HTTP503, transport abort, exact saved fields and restored enabled-switch state; page errors0. Types3502→3496/157warnings, ESLint1335→1330, zero new mapped diagnostics. Whole-project G14 remains open. The first browser update setup selected default description and was corrected in a test-only follow-up; accepted results use the final source.

Guarded production digest `sha256:b373faaef05d8b3df184679bd7a7c229c71304f485d1961b8134d6a5504b8adb`: all4914frontend/426Python hashes match,54base layers retained, backend and environment unchanged. Verified backup `/opt/backups/airis/20261006T021910Z-admin-model-candidate-116e1c02d-20261006`; checksums, archive and pg_restore listing pass. Alembic `o1a020261003`, healthy/restarts0,13neighbors and compiled Metrica111392024 preserved. Compose pin changes only the image and preserves the running container. Public health/version/env/guide/auth/root and ordinary authenticated saved chat, empty input and0₽ balance accepted. Agent sent no new generation requests.

Private receipts are stored outside Git in `/Users/yshishenya/.codex/private-artifacts/airis-admin-model-save-20261006`. Shared private plan remains193/244; no numbered completion follows from this administrative repair. Voluntary pilot, real24h/72h/14d, external Inbox/replies, physical phone and real payment/receipt gates remain open.

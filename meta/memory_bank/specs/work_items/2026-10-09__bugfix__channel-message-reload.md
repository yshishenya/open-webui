# Channel message data reload after pin/unpin

## Meta

- Type: bugfix
- Status: done (source scope)
- Owner: Codex
- Branch: codex/bugfix/channel-message-reload
- SDD Spec: meta/sdd/specs/completed/airis-channel-message-reload-2026-10-09-012.json
- Created: 2026-10-09
- Dependency: 4925dec89cd8054784b19174954b829464f0d09f, fast-forward from origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361.

## Context

G14 source work. The router-local MessageUserResponse extends MessageResponse and serializes data to bool. It shadows the imported model with the same name. Pin/unpin emits this slim response with reactions and thread fields intact. Channel/Thread replace the message under the same keyed id. Message.svelte only loads data onMount, so the already mounted renderer keeps the attachment/output skeleton indefinitely. Initial loads also apply awaited data to the current message even when a newer socket response replaced it.

## Goal / Acceptance Criteria

- [x] Reproduce both failures in the actual compiled component script before changes.
- [x] Initial and already-mounted data:true load once; full or data:false do not fetch.
- [x] Late results do not overwrite a different message/channel or newer full data, nor mutate after destruction.
- [x] A failed request ends with visible error and explicit retry; retries load the same message without a reactive loop.
- [x] Full frontend passes; type/lint introduce zero diagnostics; backend hashes are unchanged.
- [x] Source committed/pushed: `5b873b454b98fa355882cc8c6c3545586a651461`. Final docs receipt follows separately.
- [ ] General quality/preflight/PR/integration/candidate/production/real pilot acceptance.

## Scope / Non-goals

Only the shared channel message renderer and one regression file. No backend/API/schema/config/dependency changes. No additional calls to AI providers. The complete quality gate and production/real pilot acceptance remain separate.

## Upstream impact

src/lib/components/channel/Messages/Message.svelte: replace one-shot mount load with guarded reactive load and error/retry state. Keep CSS and unrelated actions/rendering unchanged. No new abstraction or runtime dependency.

## Verification

Docker Compose with the existing accepted-stage cache/network. Regression on the original and fixed source, complete frontend tests, npm run check, npm run lint:frontend, Prettier for own files, source hashes and remote SHA. A compiled-script test replaces unrelated child markup with a data probe; it tests real Svelte scheduling, mount/update/destruction and API calls, not full production layout. Backend suite from the dependency is reusable only after byte equality of all backend files. General release still requires its full same-SHA matrix, preflight, integration and live acceptance.

## Risks / Rollback

Async request ordering and retry loops. Check identity, channel and data state before applying results; reject stale responses. Revert only this isolated source commit if needed.

## Source acceptance — 09.10.2026

- Only two source/test files changed. Shared renderer serves channel, thread, parent and pinned views; only one fix needed. No backend/API/dependency/config/migration changes; CSS byte-equal.
- Actual router-local slim response traced at channels.py:756 (shadows the imported same-named model). It retains replies/reactions and emits data:true after pin/unpin. Earlier commentary briefly misidentified the imported base model; corrected before source edits. No backend response change made.
- Compiled actual instance script and actual loading/error/retry markup, with unrelated children replaced by a data probe: original9 failures/5 passes/1 unhandled rejection; fixed14/14. Checks initial and mounted pin updates, same-object rerender deduplication, overlapping replies, replacement/newer data, lost channel, null data, destruction, error and actual retry button. No swallowed failure or test skip.
- Existing loading22/unavailable-actions16 retained; together52/52. Docker full frontend1012/126files. Types2093/108 and ESLint1012 exactly unchanged by diagnostic multiset comparison. New test uses the package's untyped compiler runtime only as unknown consumed by generated JavaScript; no fake declarations/suppressions added.
- All454 backend files match dependency's1025-pass/no-skip snapshot. Backend tests/Black/Ruff not rerun in this frontend-only step; prior Black454 unchanged/Ruff547 remain reusable on those identical bytes. Full release still requires fresh same-SHA backend/frontend/E2E acceptance.
- All1064 frontend/454 backend files frozen by SHA256 before full checks; source commit matches.21protected primary files retained. Production at10:47:00.797654UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0; image/ENV/config/mounts/12neighbors equal prior baseline. No deploy/build/browser/AI requests in this step.
- Initial test harness errors (missing transpile options/legacy compiler flag and mock timing) corrected before accepted comparisons. Final original/fixed tests used the same harness; it executes real Svelte scheduling and retry markup. Initial local helper ran in primary cwd and failed to find the new test; it changed no files and was rerun in the explicit worktree. Initial SDD generator produced a four-digit time suffix; own spec renamed to canonical012 and task file paths/category added after validator feedback. No shared SDD changed.
- Evidence: `/Users/yshishenya/.codex/private-artifacts/airis-channel-message-reload-20261009`: test-acceptance.json, tested-source-snapshot.json, original-accepted-regression.log, final-regression-typed.log, frontend-tests.log, frontend-check-final.log, frontend-lint.log, source-format.log, production-after.json and receipt.json. SDD2/2 source tasks complete; final schema/clean-remote receipt recorded separately.

## Next required work

Remaining renderer/input/member types and unrelated general quality errors; fresh clean image and full required tests; production browser acceptance and real A/B mail/payment/pilot windows. This source step closes no numbered launch criterion: plan198/244,goalactive.

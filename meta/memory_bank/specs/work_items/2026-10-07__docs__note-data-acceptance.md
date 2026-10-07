# Notes release acceptance documentation

- Type: docs
- Status: Done
- Owner: Codex
- Branch: codex/docs/note-data-contracts-acceptance
- Implementation Spec: meta/memory_bank/specs/work_items/2026-10-07**refactor**note-data-contracts.md
- SDD Spec: meta/sdd/specs/completed/airis-note-data-contracts-2026-10-07-001.json

## Scope and measurable completion

Publish accepted note contracts and failed-list recovery evidence, complete the implementation SDD, and preserve the application tree from PR361. Private onboarding documents and foreign edits remain outside this commit.

- [x] Source511e50d43d025b0a38dafac72e4572c8beebfe88 and mergeb3fa9375401be4ca4a1acaefbfde7aacff7d0800 have equal trees; applicable exact-source CI passed.
- [x] Full939/939frontend checks and compiled84/84browser cases passed, no failures/skips; new normalized diagnostics0.
- [x] Guarded production, backup/rollback, money/configuration preservation, public files and pin accepted.
- [x] Implementation SDD4/4 completed; documentation formatting and schema checks passed.
- [x] Documentation-only changes preserve the application tree; exact-source publication CI is required before merge.

## Upstream impact and limitations

Documentation only; no new dependency, migration or runtime change. Global quality remains red:2318type errors/108warnings and1020ESLint errors. Existing ResizeObserver lifetime is unchanged. Self-review is recorded; independent review is not claimed. Browser fixtures do not prove real SMTP/provider/payment/physical-device/volunteer/calendar acceptance. Overall198/244 remains active.

## Accepted source and production

Source `511e50d43d025b0a38dafac72e4572c8beebfe88`; PR361 merge `b3fa9375401be4ca4a1acaefbfde7aacff7d0800`, equal trees. Applicable exact-source CI accepted; dependency-review and independent bot review skipped as reported by CI. Full939/939frontend checks and Chromium42/42 + Firefox390px42/42,84/84,0failures/errors/skips. Frozen6586source files and3private test files preserved. API/store/types erased JavaScript identical; executable component deltas have actual-code and compiled-path evidence.

Release `20261007T204253Z-notes-511e50d43d-20261007`; image `yshishenya/yshishenya:notes-511e50d43d-20261007`, digest `sha256:26ddb9a331228a468614903e7ab493e8741a7b8163495a65a53ee844ac55f535`. All4915frontend/427Python files match candidate; raw backend496files preserved in image,495unchanged at runtime and existing startup replaces static/site.webmanifest from accepted frontend.326generated Python caches map to existing owners. Healthy/restarts0, money SELECT-only/DML0, runtime ENV/compose/mounts/12neighbors preserved. Public health/version/env/guide and4changed compiled assets accepted; guide examples/support/Metrica111392024 retained.11-file backup, previous accepted backup and rollback image verified. Image atomically pinned without second recreation; free space11.76GiB.

Two exact old06.10backups admin-model-listener95acc… and admin-settings-save1d7… copied to P4_codex:/var/tmp/airis-note-backups-20261007.22files/3134864657bytes match sizes/SHA256; both tar archives and pg_restore listings readable and listing hashes match. Only the two server originals removed under deploy lock after fresh source rehash and runtime checks; five latest07.10backups retained and verified. Direct SSH route failed before authentication; existing KVN hop and server-to-server copy used with known host key and forwarded agent. No server access configuration changed.

Local cleanup removed only3own fixtures and own empty network,0volumes deleted;76foreign image/config/semantic mount records preserved.21foreign primary tracked files match original hashes. Full quality remains red:2318type errors/108warnings,1020ESLint; normalized new diagnostics0 and modified errors0. No dependency/backend/schema/suppression/config relaxation. Overall198/244 and all real-user/mail/payment/device/pilot/calendar conditions remain open. Private evidence: `/Users/yshishenya/.codex/private-artifacts/airis-note-data-contracts-20261007`.

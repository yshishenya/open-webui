# Chat list record contract

## Meta

- Type: bugfix
- Status: done (implementation/local verification; exact-source integration recorded separately)
- Owner: Codex
- Branch: codex/bugfix/chat-list-record-contract
- SDD Spec: meta/sdd/specs/completed/airis-chat-list-record-contrac-2026-10-05-2149.json
- Created: 2026-10-05

## Cause and traced flow

The existing ChatListItem describes id and leaves every other field unknown. Sidebar and other store consumers read numeric timestamps, nullable read state, boolean active and translated time_range. ChatTitleIdResponse provides title/created_at/updated_at/last_read_at/snippet/active; chat API helpers add time_range. Full ChatResponse passed to the folder-refresh registry also carries nullable folder_id/pinned. Store updater functions accept sparse snapshots and preserve arbitrary enrichment, so these fields remain optional and the existing unknown-valued extension index is retained.

This repairs shared declarations for G14/13.11; it does not complete the full A/B goal. Initial null, pagination generation, deduplication, readonly stores and updates remain unchanged. No new dependency, response transformation, runtime assertion or schema change.

## Measurable acceptance

- [x] Strict compile-only probe fails before the repair and passes afterwards; numeric dates/nullable read state/boolean active/string labels accepted, wrong scalar values rejected, minimal id snapshot still accepted.
- [x] Full mapped strict diagnostics reduce with zero new issues; reworded old issues remain explicitly open.
- [x] Whole emitted store module is byte identical before/after.
- [x] Docker Compose frontend tests pass; full ESLint is compared, focused formatting/lint and SDD validation pass.
- [x] Exact source committed/pushed, CI and integration proof recorded separately.

## Upstream impact and rollback

Only existing record declarations in src/lib/stores/chatList.ts; probe is additive under src/lib/utils/airis. No component or API implementation changed. Revert declarations if consumers regress. Deployment is unnecessary only after complete compiler output equality is proven.

## Verified result

Application check3651→3643 errors/159 warnings:8 removed,0 new. One existing Sidebar i18n diagnostic now mentions string|undefined rather than unknown; it remains open. Strict compiler probe18 baseline errors→0, including wrong dates/read states/labels/activity flags and minimal snapshots. Docker Compose555/555 tests in80 files. Full eslint .1384→1384 and exact diagnostic list unchanged; full check/lint remain nonzero on existing debt. Complete emitted module3838 bytes has unchanged SHA256 c929c2d2fa1ee62d55de6281d837f85b2f9e1677042e4cf8e5d0d25cc03e6052. No application deployment needed; SDD2/2 closed. Final source/CI/merge evidence recorded in PR/private acceptance. No numbered plan task or G14 is closed by this declaration repair.

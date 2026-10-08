# Recover chat list requests

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-list-request-recovery
- SDD Spec: meta/sdd/specs/completed/airis-chat-list-request-recovery-2026-10-08-001.json
- Base:93184a8161beee815445195eef5b10cf9eedd2b7; accepted application511e50.
- Plan: G14/13.16; overall198/244 remains active.

## Final scoped goal and measurable acceptance

Search and sidebar lists recover from initial and next-page request failure while preserving existing rows. Retry requests the same page; failed loads cannot produce uncontrolled Loader requests or leave UI loading active.

- [x] Trace getChatList/search/store and both UI consumers; reproduce actual rejected handlers before repair.
- [x] Initial and later failed requests release loading, preserve existing rows, page/total and offer explicit Retry; successful retry deduplicates IDs.
- [x] A stale search response cannot overwrite a later query; the fix preserves shared store generation and account boundaries.
- [x] Existing native types/helpers reused;0newdependencies/backend/schema/Any/suppression/configrelaxation.
- [x] Minimal runnable regressions fail on original and pass repaired code; compiled Chromium/Firefox390px paths accepted.
- [x] Exact-sourceCI/integration/guardedproduction/backup/rollback/data/money/config accepted;SDD and docs completed.

## Causal trace and minimum scope

SearchModal.loadMoreChats sets loading=true and page+=1 before awaiting API. Rejection escapes and leaves both stuck; successful next requests would skip the failed page. Sidebar store loadNextChatListPage keeps currentPage and releases its own loading in finally, but Sidebar.loadMoreChats leaves component loading true on that thrown rejection. Sidebar.refreshChatRows also lacks an initial failure state; shared refresh retains store rows but clears paginationReady until successful refresh. Existing Loader emits every100ms while visible, so simply clearing loading would cause repeated failed requests. Keep failure state in each UI; Retry replaces failed Loader and initial spinner. Preserve existing API throw contracts and store behavior unless traced evidence requires a shared correction.

SearchModal debounce/query results share mutable page/query; guard old async results while changing query or closing. Reuse existing ChatTitleIdResponse/time_range and actual handlers in tests. Do not mix this repair with whole component type cleanup or unrelated folder/preview behavior.

## Upstream impact

Minimal hooks in SearchModal/Sidebar and one focused actual-handler test; existing compiled browser scenario extended. No new abstraction or duplicated store. Full global quality debt remains open. Browser fixtures do not prove SMTP/provider/payment/physical-device/human/pilot/calendar acceptance.

## Verification and rollback

Docker Compose frontend tests/scopedformat/lint/fulltypecomparison and compiled browser paths. Record fullsourceSHA, reproducible failure and accepted image. This completed rollout used the accepted notes image, exact runtime CAS and guarded backup/rollback; preserve111private documents,21foreignprimary trackedfiles and77foreignlocalcontainers. Release once if verified; no prune/volume removal.

## Source verification before frozen candidate

7/7 actual-handler/compiler regressions and 946/946 frontend tests (121 files) pass. The compiled show reaction now depends only on show: close cancellation is a local function, avoiding reactive self-trigger through generation/timer reads. Full types2318→2293 errors,108warnings; normalized file/message/count new0. Full ESLint1020 remains open; scoped changed files pass. Existing empty-sidebar E2E extended for initial/page503, explicit Retry, samepage and retained/deduplicated rows in sidebar and search; compiled execution was pending at this initial checkpoint; final acceptance is below. No new dependencies or shared-store/API changes.

## Accepted scoped release — 2026-10-09

PR363 source `5e2a8c06169e6111fdc9576629acb8841f66a8cb`, merge `a7b2de933f4e88eff087784dfb6cf92d1e59a412`; trees equal. Applicable CI: 10 successful checks, 1 skipped dependency review and 1 successful status reporting disabled third-party review. All 946 frontend / 7 handler-compiler checks and 42 Chromium + 42 Firefox 390px cases pass, 0 failures/errors/skips. Full final types: 2293 errors / 108 warnings and ESLint: 1020 errors remain open; normalized new: 0 in both.

Production `yshishenya/yshishenya:chat-list-5e2a8c0616-20261008`, registry/server identity `sha256:08845b48cc996cdf5aaa34cbd41c3eb75850fda3a962adfbeb1bd5e6373f55dd`. Candidate/server/live: 4915 frontend and 427 Python files match. All 496 raw backend image files unchanged; existing startup only regenerates site.webmanifest and valid Python caches. Base layers/labels/environment, runtime configuration/mounts, 12 neighbors and SELECT-only money snapshot preserved. Public version/env/guide and 2 compiled changed assets match; 11 backup files, readable dump/tar and prior rollback retained. Image pinned atomically without a second recreation. First post-start Docker health sample was still starting; its failed acceptance is retained. Fresh full acceptance requires healthy/restarts0 and passes.

Failed browser attempts remain recorded: native dialog selector, host clock jump in artificial checkout, incomplete synthetic preview and native mobile search-close behavior. Checks retain the pageerror gate, normal clicks and real timers; artificial checkout fixes Date only, not real calendar acceptance.

SDD 4/4 closed. Overall plan: 198/244, 46 numbered items open, 0 numbered closures for this scoped release; G14/13.11/13.16 and the final goal stay active. Inbox/Reply-To/two operators/physical phone/real payment/usefulness/volunteers/24h/72h/14d/mature cohort require their own evidence.

New storage instructions received after rollout: future images must use a clean reproducible source basis, without successive application overlays. Local free space checked at 123.25 GiB; keep 80 GiB and resolve/transfer heavy work below 50 GiB. Temporary copies are cleaned only after final proof, while journals/manifests/private tests and failure traces remain. Production backups remain in closed server storage; no user backup, Docker volume, Git worktree or VM snapshot is deleted.

Private proof directory: airis-chat-list-request-recovery-20261008; no private manifests/data published.

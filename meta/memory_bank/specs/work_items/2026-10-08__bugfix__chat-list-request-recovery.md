# Recover chat list requests

- Type: bugfix
- Status: In Progress
- Owner: Codex
- Branch: codex/bugfix/chat-list-request-recovery
- SDD Spec: meta/sdd/specs/active/airis-chat-list-request-recovery-2026-10-08-001.json
- Base:93184a8161beee815445195eef5b10cf9eedd2b7; accepted application511e50.
- Plan: G14/13.16; overall198/244 remains active.

## Final scoped goal and measurable acceptance

Search and sidebar lists recover from initial and next-page request failure while preserving existing rows. Retry requests the same page; failed loads cannot produce uncontrolled Loader requests or leave UI loading active.

- [x] Trace getChatList/search/store and both UI consumers; reproduce actual rejected handlers before repair.
- [x] Initial and later failed requests release loading, preserve existing rows, page/total and offer explicit Retry; successful retry deduplicates IDs.
- [x] A stale search response cannot overwrite a later query; the fix preserves shared store generation and account boundaries.
- [x] Existing native types/helpers reused;0newdependencies/backend/schema/Any/suppression/configrelaxation.
- [ ] Minimal runnable regressions fail on original and pass repaired code; compiled Chromium/Firefox390px paths accepted.
- [ ] Exact-sourceCI/integration/guardedproduction/backup/rollback/data/money/config accepted;SDD and docs completed.

## Causal trace and minimum scope

SearchModal.loadMoreChats sets loading=true and page+=1 before awaiting API. Rejection escapes and leaves both stuck; successful next requests would skip the failed page. Sidebar store loadNextChatListPage keeps currentPage and releases its own loading in finally, but Sidebar.loadMoreChats leaves component loading true on that thrown rejection. Sidebar.refreshChatRows also lacks an initial failure state; shared refresh retains store rows but clears paginationReady until successful refresh. Existing Loader emits every100ms while visible, so simply clearing loading would cause repeated failed requests. Keep failure state in each UI; Retry replaces failed Loader and initial spinner. Preserve existing API throw contracts and store behavior unless traced evidence requires a shared correction.

SearchModal debounce/query results share mutable page/query; guard old async results while changing query or closing. Reuse existing ChatTitleIdResponse/time_range and actual handlers in tests. Do not mix this repair with whole component type cleanup or unrelated folder/preview behavior.

## Upstream impact

Minimal hooks in SearchModal/Sidebar and one focused actual-handler test; existing compiled browser scenario extended. No new abstraction or duplicated store. Full global quality debt remains open. Browser fixtures do not prove SMTP/provider/payment/physical-device/human/pilot/calendar acceptance.

## Verification and rollback

Docker Compose frontend tests/scopedformat/lint/fulltypecomparison and compiled browser paths. Record fullsourceSHA, reproducible failure and accepted image. Use latestnotes image as base, exact runtimeCAS and guarded backup/rollback; preserve111private documents,21foreignprimary trackedfiles and76foreignlocalcontainers. Release once if verified; no prune/volume removal.

## Source verification before frozen candidate

7/7 actual-handler/compiler regressions and 946/946 frontend tests (121 files) pass. The compiled show reaction now depends only on show: close cancellation is a local function, avoiding reactive self-trigger through generation/timer reads. Full types2318→2293 errors,108warnings; normalized file/message/count new0. Full ESLint1020 remains open; scoped changed files pass. Existing empty-sidebar E2E extended for initial/page503, explicit Retry, samepage and retained/deduplicated rows in sidebar and search; compiled execution pending. No new dependencies or shared-store/API changes.

# Shared knowledge data contracts

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/refactor/knowledge-data-contracts
- SDD Spec: meta/sdd/specs/completed/airis-knowledge-data-contracts-2026-10-07-001.json
- Plan: global quality G14/13.11 in the private onboarding-retention implementation plan. Overall198/244 remains active.

## Final scoped result and measured acceptance

Replace the obsolete four-field document record contract and incomplete local knowledge descriptions with actual server response contracts, shared by APIs, stores, knowledge list/editor, file displays and chat/model selectors. Baseline integration c6702ef8c7c6fa92efee60c45aea3aade3411f39 has the same application source as accepted62c57: full types2599errors/111warnings, ESLint1097errors, KnowledgeBase117errors, frontend933tests. No runtime defect is claimed from a type diagnostic.

- [x] Trace every selected API producer and consumer, including legacy/nullable metadata and directory/file shapes.
- [x] Reuse existing file/attachment, user and access definitions; no duplicate abstractions.
- [x] KnowledgeBase and directly modified contracts have0type errors; normalized new diagnostics0 across the whole project.
- [x] Modified files pass lint/format; no new dependencies, Any, suppressions or configuration relaxation.
- [x] Full frontend suite passes at least933tests; any executable guard/change has a minimal actual-code regression.
- [x] Type-only source emits identical JS; any executable change is reproduced and accepted in compiled scenarios before protected production rollout.
- [x] Applicable exact-source CI and integration accepted, SDD/docs completed, branch committed and pushed.

## Scope, compatibility and upstream impact

Use a fork-owned type module only for missing knowledge/file/directory records. Narrow annotations/hooks in stores, APIs and their consumers. Preserve existing endpoint/request/pagination/access/metadata behavior and data. Explicit executable deltas: list/listitem roles, diagnostics for failed polling/malformed drag, dead handlers removed and equivalent native directory loop. No backend, database, payment, mail or provider changes. Existing TypeScript/Svelte/Paneforge remain pinned; no new integration or library replacement. Read installed library declarations if a component binding needs an unfamiliar type. Compiler upgrade is a separate compatibility task. Do not export/copy full backend, reset Docker, delete data/volumes or touch21foreign primary tracked edits.

## Initial causal trace

Full-file trace corrected the initial hypothesis: stores/index.ts declares its own Document at line280, with collection_name/filename/name/title. It is obsolete, not the browser DOM type. Store knowledge uses that unrelated four-field shape. Server models distinguish knowledge details/list, directory rows and file lists, while current API answers are untyped. KnowledgeBase duplicates Knowledge with any files/grants/meta and legacy data.file_ids; it also has nullable file/directory state. All consumers must be traced before changing their common source. Additional native directory entry/Pane/event types must come from the installed/platform API. Private evidence root: airis-knowledge-data-contracts-20261007.

## Implemented contracts and staged verification

23 knowledge API exports now describe real detail/list/file/directory/sync outputs. List file_count is always a number in both actual list producers (missing count -> 0); nullable metadata/data/timestamps are retained. Pending files use full FileModelResponse. UI grants reuse FolderAccessGrant; server grants reuse ToolListItem. Existing fetch/error/request serialization remains unchanged, including the list empty-array catch fallback. Native filesystem and Pane types come from the pinned installed declarations. Generic Select/DropdownOptions use Svelte native legacy generic markers with an explicit type-only identity import for the pinned ESLint parser; no rule suppression or configuration change.

Phase 1 proof emission-r1.json: 12 existing modules emitted identical normalized JS. This is not the final executable-change proof. Final tranche adds list/listitem roles, useful diagnostics, removes unused local handlers, and preserves native reader batch termination. Two minimal actual-code regressions passed (reader loop and mounted real Files selection/rename). Compiled knowledge scenario uses known API response fixtures and must not be called live storage integration. Overall plan remains198/244; no numbered criterion is closed by this refactor alone.

## Accepted release evidence

Final application source09866a65c10c304ef3a2e0f733668429ea06113c merged by PR359 as722d3b4a329ff76f95517e8360b09b0b72092d24, equal full trees. Applicable exact-source CI accepted; independent review not claimed. Full frontend935/935 in118files on df373; application bytes equal final09866, whose only later delta is narrow Notes test readiness. Final build passed and Chromium42/42 + Firefox390px42/42 passed against final image,0failures/errors/skips. Private setup executions excluded; API/provider/mail/payment fixtures do not establish live external integrations. Initial failed harness/readiness runs retained. Supported Rename menu accepted; existing double-click opens Drawer and remains an explicit limitation.

Full types2599errors/111warnings→2451/110; ESLint1097→1037, normalized new diagnostics0, modified files0type/lint errors. Whole-project debt remains open; no new dependencies/Any/suppressions/config relaxation. Native directory and mounted Files regressions passed.

Guarded release20261007T193400Z-knowledge-09866a65c1-20261007: registry/runtime digestsha256:d71fabcb4f710d2dc0adbf4344f905056307fc3990b6da07fef0c1d41f0ba1cd, local configsha256:fdac48f74c5191764fb976e01bbfdabbcbac8133734ddbefe531afba15493509.4915frontend/427Python files equal accepted candidate. Full backend496files preserved; runtime495identical and existing startup replaces static/site.webmanifest with accepted frontend manifest,326Python caches have accepted source owners. Money SELECT-only/DML0, ENV/config/mounts/14neighbors preserved,healthy/restarts0; public version/guide/Metrica111392024 and3changed JS hashes accepted. Initial Docker healthstarting snapshot retained; subsequent healthy accepted. Backup11files readable with verified checksums; previous core backup/rollback retained. Pin changed only2image values,container not recreated,free10.58GiB.

Old06.10admin-model backup transferred to P4_codex:11files/1567431447bytes,hashes/sizes/archive/dump verified before exact original removal;4fresh07.10backups retained. Local disk-full stopped Docker during initial run/push;65own generated outputs removed after full manifests,source/logs/backups/volumes retained. Final image byte-identical after recovery;77existingcontainer identities/config/semantic mounts preserved,states/restart counts not asserted unchanged.21foreigntrackedfiles preserved. Private proof root: airis-knowledge-data-contracts-20261007.

SDD4/4completed. Overall198/244/46open,global quality and real users/mail/device/payment/pilot/calendar conditions remain open; final goal active.

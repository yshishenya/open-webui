# Shared knowledge data contracts

- Type: refactor
- Status: In Progress
- Owner: Codex
- Branch: codex/refactor/knowledge-data-contracts
- SDD Spec: meta/sdd/specs/active/airis-knowledge-data-contracts-2026-10-07-001.json
- Plan: global quality G14/13.11 in the private onboarding-retention implementation plan. Overall198/244 remains active.

## Final scoped result and measured acceptance

Replace the obsolete four-field document record contract and incomplete local knowledge descriptions with actual server response contracts, shared by APIs, stores, knowledge list/editor, file displays and chat/model selectors. Baseline integration c6702ef8c7c6fa92efee60c45aea3aade3411f39 has the same application source as accepted62c57: full types2599errors/111warnings, ESLint1097errors, KnowledgeBase117errors, frontend933tests. No runtime defect is claimed from a type diagnostic.

- [ ] Trace every selected API producer and consumer, including legacy/nullable metadata and directory/file shapes.
- [ ] Reuse existing file/attachment, user and access definitions; no duplicate abstractions.
- [ ] KnowledgeBase and directly modified contracts have0type errors; normalized new diagnostics0 across the whole project.
- [ ] Modified files pass lint/format; no new dependencies, Any, suppressions or configuration relaxation.
- [ ] Full frontend suite passes at least933tests; any executable guard/change has a minimal actual-code regression.
- [ ] Type-only source emits identical JS; any executable change is reproduced and accepted in compiled scenarios before protected production rollout.
- [ ] Applicable exact-source CI and integration accepted, SDD/docs completed, branch committed and pushed.

## Scope, compatibility and upstream impact

Use a fork-owned type module only for missing knowledge/file/directory records. Narrow annotations/hooks in stores, APIs and their consumers. Preserve existing endpoint/request/pagination/access/metadata behavior and data. Explicit executable deltas: list/listitem roles, diagnostics for failed polling/malformed drag, dead handlers removed and equivalent native directory loop. No backend, database, payment, mail or provider changes. Existing TypeScript/Svelte/Paneforge remain pinned; no new integration or library replacement. Read installed library declarations if a component binding needs an unfamiliar type. Compiler upgrade is a separate compatibility task. Do not export/copy full backend, reset Docker, delete data/volumes or touch21foreign primary tracked edits.

## Initial causal trace

Full-file trace corrected the initial hypothesis: stores/index.ts declares its own Document at line280, with collection_name/filename/name/title. It is obsolete, not the browser DOM type. Store knowledge uses that unrelated four-field shape. Server models distinguish knowledge details/list, directory rows and file lists, while current API answers are untyped. KnowledgeBase duplicates Knowledge with any files/grants/meta and legacy data.file_ids; it also has nullable file/directory state. All consumers must be traced before changing their common source. Additional native directory entry/Pane/event types must come from the installed/platform API. Private evidence root: airis-knowledge-data-contracts-20261007.

## Implemented contracts and staged verification

23 knowledge API exports now describe real detail/list/file/directory/sync outputs. List file_count is always a number in both actual list producers (missing count -> 0); nullable metadata/data/timestamps are retained. Pending files use full FileModelResponse. UI grants reuse FolderAccessGrant; server grants reuse ToolListItem. Existing fetch/error/request serialization remains unchanged, including the list empty-array catch fallback. Native filesystem and Pane types come from the pinned installed declarations. Generic Select/DropdownOptions use Svelte native legacy generic markers with an explicit type-only identity import for the pinned ESLint parser; no rule suppression or configuration change.

Phase 1 proof emission-r1.json: 12 existing modules emitted identical normalized JS. This is not the final executable-change proof. Final tranche adds list/listitem roles, useful diagnostics, removes unused local handlers, and preserves native reader batch termination. Two minimal actual-code regressions passed (reader loop and mounted real Files selection/rename). Compiled knowledge scenario uses known API response fixtures and must not be called live storage integration. Overall plan remains198/244; no numbered criterion is closed by this refactor alone.

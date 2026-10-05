# Shared folder state contracts

## Meta

- Type: bugfix
- Status: done (local implementation/verification; exact-source integration tracked separately)
- Owner: Codex
- Branch: codex/bugfix/folder-state-contracts
- Created: 2026-10-05
- SDD Spec: meta/sdd/specs/completed/airis-folder-state-contracts-2026-10-05-001.json

## Cause and traced flow

The folders store starts with [] inferred as never[]; selectedFolder starts with null inferred as null-only. List data comes from FolderNameIdResponse; selected data comes from full FolderModel plus shared/list enrichment. Trace getFolders, getFolderById, automation consumers, Sidebar, route lifecycle, RecursiveFolder and FolderTitle assignments. List and selected data differ; use the existing fork-owned frontend-contracts module. Preserve initial []/null, arbitrary enrichment and actual nullable metadata/data. No API implementation or state transitions change. Follow the selected record through FolderTitle; its existing nullable prop is described using the same type. FolderModal folderId/parentId and EmojiPicker selected admit existing strings and null. createNewChat admits the already normalized undefined folder argument (folderId ?? null); both callers were traced.

## Acceptance

- [x] Strict compile-only regression fails before repair and passes after; valid list/full/clear states accepted, invalid IDs/dates/model arrays rejected.
- [x] Whole application diagnostics reduce with zero new errors; changed messages on existing issues stay open.
- [x] Complete emitted modules are byte-identical; all frontend tests pass and full ESLint has zero new issues.
- [ ] SDD schema/policy and exact-source CI/integration verified before final closure.

## Upstream impact

Generic arguments/type imports in stores/index.ts; fork-owned declarations/probe additive. Minimal declarations in FolderTitle, FolderModal, EmojiPicker and createNewChat. Component algorithms, API serialization, dictionaries, permissions, shared access, sorting and persistence unchanged. Revert declarations on regression; no app deployment only after complete output equality is proven.

## Full-goal boundary

G14/13.11 and the 193/244 A/B goal remain open. Remaining nullable FolderTitle callback diagnostics, Sidebar placeholder dictionaries, nullable move parameters and channels are separate causes, not claimed fixed here.

## Verified local result

Whole strict app3643→3593 errors:50 removed,0 new;159 warnings remain. Complete regression13→0;valid list/full/clear states accepted and wrong scalar values rejected. All555 frontend tests in80 files pass. Full ESLint1384 unchanged after source-line offsets mapped,focused lint/format pass. All9 full emitted outputs (stores/contracts/chat API;FolderTitle/FolderModal/EmojiPicker client+server) byte-identical. Initial []/null,folderId ?? null,all callbacks and serialization remain unchanged. General check/lint still exit1 on existing debt. SDD2/2 closed;exact-source CI/merge proof must be recorded before accepting delivery. No numbered A/B task is closed by this declaration repair.

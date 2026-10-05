# Shared folder state contracts

## Meta

- Type: bugfix
- Status: locally verified; revised exact-source CI, integration and deployment pending
- Owner: Codex
- Branch: codex/bugfix/folder-state-contracts
- Created: 2026-10-05
- SDD Spec: meta/sdd/specs/completed/airis-folder-state-contracts-2026-10-05-001.json

## Cause and traced flow

The folders store starts with [] inferred as never[]; selectedFolder starts with null inferred as null-only. List data comes from FolderNameIdResponse; selected data comes from full FolderModel plus shared/list enrichment. Trace getFolders, getFolderById, automation consumers, Sidebar, route lifecycle, RecursiveFolder and FolderTitle assignments. List and selected data differ; use the existing fork-owned frontend-contracts module. Preserve initial []/null, arbitrary enrichment and actual nullable metadata/data. No API implementation or state transitions change. Follow the selected record through FolderTitle; its existing nullable prop is described using the same type. FolderModal folderId/parentId and EmojiPicker selected admit existing strings and null. createNewChat admits the already normalized undefined folder argument (folderId ?? null); both callers were traced.

## Acceptance

- [x] Strict compile-only regression fails before repair and passes after; valid list/full/clear states accepted, invalid IDs/dates/model arrays rejected.
- [x] Whole application diagnostics reduce with zero new errors; changed messages on existing issues stay open.
- [x] Complete emitted modules are hashed and differences recorded; all frontend tests pass and full ESLint has zero new issues. Initial byte equality is superseded by the CI repair below.
- [ ] SDD schema/policy and exact-source CI/integration verified before final closure.

## Upstream impact

Generic arguments/type imports in stores/index.ts; fork-owned declarations/probe additive. Minimal declarations in FolderTitle, FolderModal, EmojiPicker and createNewChat. Component algorithms, API serialization, dictionaries, permissions, shared access, sorting and persistence unchanged. Revert declarations on regression; no app deployment only after complete output equality is proven.

## Full-goal boundary

G14/13.11 and the 193/244 A/B goal remain open. Remaining nullable FolderTitle lifecycle diagnostics, Sidebar placeholder dictionaries and channels are separate causes, not claimed fixed here. Nullable move parameters are included in the revised candidate below.

## CI repair and final local result

CI on the initial source 4402afa782a6eb1649022a173047872c534b14f3 failed changed-file ESLint on 16 existing issues. The initial byte-identical proof applies only to that superseded candidate. Remove unused imports/parameters and the unused EmojiPicker user prop (all five consumers traced; none passes it). Replace broad Function callbacks with concrete signatures, including the always-present parent_id key whose value can be undefined. Describe EmojiPicker's actual string/null callback; status accepts null as the server form does, reaction/formatting callers skip null instead of sending an invalid reaction or indexing it. Replace the constant-condition stream loop with the equivalent for (;;) and test empty/fragmented UTF-8/final-line handling in the existing chat API test file.

Trace all chat/folder move callers and the nullable server forms; admit existing root null values in both API parameters. Existing FolderForm and access-grant payload types use unknown without changing serialization. No weakening of lint/check configuration or new dependency.

Final strict app3643→3584 errors:59 removed,0 new;159→158 warnings. Original folder-state regression13→0, move regression2→0 with eight compile assertions; strings/omitted destinations accepted and numeric destinations rejected. All557 frontend tests in80 files pass. Full ESLint1384→1360:24 removed,0 new after source-line offsets; all13 changed frontend files pass lint. Formatting passes12/13; channel/Messages/Message.svelte retains a pre-existing formatting failure, with the diff limited to two null guards. General check/lint still exit1 on remaining debt. The revised emitted outputs differ; deployment remains pending and the old no-deployment claim is withdrawn. Exact-source CI, merge and release proof must be recorded before accepting delivery. No numbered A/B task is closed here.

Upstream impact additionally includes minimal null guards in channel/Messages/Message.svelte and RichTextInput/FormattingButtons.svelte, nullable status/callback declarations and unused imports in Sidebar/UserStatusModal.svelte, two API parameter unions, existing chat API tests and removal of existing explicit any payload annotations in apis/folders/index.ts. Initial stores []/null, request bodies, server permissions and persistence are preserved. Remaining dictionaries and nullable folder handler lifecycle errors stay open.

# Model editor configuration contracts and nullable data

## Meta

- Type: bugfix
- Status: local acceptance complete; publication and runtime acceptance pending
- Owner: Codex
- Branch: codex/bugfix/model-editor-contracts
- SDD Spec: meta/sdd/specs/completed/airis-model-editor-contracts-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context and goal

The shared Model catalog is accepted in PR344, but ModelEditor still has 124 type errors. Its prop is inferred as null, editable metadata only describes initial literals, and arrays/DOM bindings lack types. Reuse the actual configuration and component contracts. Server knowledge is a nullable list of arbitrary values, including primitives: do not pretend every entry is an object. Null knowledge crashes editor submission/rendering; a missing canvas context crashes profile upload.

## Acceptance criteria

- [x] Trace create/edit/admin callers and backend configuration/knowledge variants.
- [x] Reuse ModelConfig, ModelParams, SkillListItem and existing access-grant/component contracts; no Any, suppressions, dependencies or weaker rules.
- [x] Preserve metadata, stop conversion, reference allowlist and all non-object knowledge values; safely handle null knowledge and unavailable image context.
- [x] Actual editor submission/upload paths and knowledge rendering have runnable regression checks; ordinary valid paths remain unchanged.
- [x] Full frontend suite passes; changed-file lint/format clean, full diagnostic comparison has no new errors and removes the editor's original failures.
- [ ] Exact-source PR/CI accepted; runtime changes explicitly await compiled candidate/final release acceptance and are not counted as production behavior prematurely.

## Upstream impact

Minimal declarations/hooks in ModelEditor and its Knowledge widget; metadata additions in src/lib/apis/index.ts describe already persisted fields. No API requests, access permissions, billing, stored schema or migrations change. Child Knowledge retains unknown entries in the selected list, hides non-object rows, and preserves original indices for removal. The existing reference sanitizer stays in the editor; this work adds no second sanitizer or subsystem.

## Verification and dependencies

Docker Compose full frontend/check/lint, changed-file checks, actual source handler regression tests and compiler comparison. Existing Svelte5.56.0/TypeScript5.9.3 remain pinned; official docs were read during PR344 and no integration/dependency is introduced or replaced. Runtime differences and CSS equality are recorded separately. Deployment uses the current accepted production backend/base; unrelated changes remain protected.

## Risks and completion

JSON import remains an unvalidated trust boundary and is not made valid merely by assigning ModelConfig. Preserve null/primitive knowledge in the outgoing payload; hide values the widget cannot display instead of silently deleting them. Revert the isolated source or retain prior runtime to roll back. Global quality, real pilot and calendar acceptance remain open.

## Local acceptance

Full frontend **867/867**,105files; all three new tests fail on original code and pass on the correction. Editor errors **124→0**, full type errors **3189→3065**, warnings118 unchanged, normalized new diagnostics0. One existing PromptEditor unknown aria-label error prints the widened Textarea.value type; its cause and location remain unchanged and open. Full ESLint **1164→1161**, five touched source/test files lint0. Shared API and Textarea have identical emitted JavaScript; all changed Svelte CSS remains identical. Runtime fixes are limited to editor/knowledge guards, preserve source images when canvas is unavailable and retain arbitrary saved knowledge values. Textarea already binds directly to the native value and now truthfully accepts null/undefined; no runtime code change.

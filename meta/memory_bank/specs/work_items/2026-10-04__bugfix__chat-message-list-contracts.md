# AIRIS — контракт списка сообщений чата

## Meta

- Type: bugfix
- Status: done (source checks; CI/merge and production separate)
- Owner: Codex
- Branch: codex/bugfix/chat-history-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-history-contracts-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context

Empty object/array inference causes 110 errors in the shared Messages component. Its six consumers use the existing persisted parent/children graph. Callback Function types and unused props also prevent touched-file CI lint from passing. A stored empty chat without history gives the hover preview a null value instead of the component default.

## Goal / Acceptance Criteria

- [x] Describe the repaired graph and edit payload with concrete types, preserving output and attachments.
- [x] All source-handler checks pass for paging, streaming updates, branch navigation, editing, annotations, deletion and persistence failure.
- [x] The actual empty Messages component mounts without an uncaught error when history is undefined.
- [x] All six changed source/test files pass strict ESLint, without new rule disables.
- [x] Full diagnostics shrink with zero added diagnostics; all frontend tests pass.
- [x] Freeze a reviewable source revision; production and final product acceptance remain separate.

## Scope and implementation

Add the small graph/edit contract under src/lib/utils/airis, reusing OutputItem. Type Messages state/actions and two existing Chat callbacks. Remove dead imports, prompt/showMessage props and their caller bindings. Map null hover history to undefined so Messages uses its valid empty default. Keep persistence, send/edit/delete/branch algorithms and unknown fields in existing round trips.

## Non-goals

No provider, billing, database, persistence-format or dependency change. Existing TypeScript 5.9.3 is retained for repository toolchain compatibility; registry stable 7.0.2 and official optional-property documentation were checked. A toolchain upgrade is separate work. Cyclic ancestry and child descent require a separately verified traversal fix.

## Upstream impact

Messages.svelte: types, valid empty default, unused imports/props, two explicit div closing tags and unused Loader callback argument. Chat.svelte: two typed callbacks and removal of the dead Messages props. ChatHoverPreview.svelte: concrete context/history and empty-history default mapping. Existing unrelated formatting is preserved; Chat.svelte has five pre-existing Prettier differences, outside the changed lines. The graph contract and two runnable checks are additive.

## Verification

Docker Compose frontend suite: 458/458 tests, 68 files. Fourteen source-handler checks plus one actual Svelte/jsdom empty mount. The previous source fails the concrete-type probe while its thirteen unchanged-behavior scenarios pass. Full svelte-check: 4204/174 to 4087/170; 117 errors and four warnings removed. Four existing consumer diagnostics rewrite generated prop schemas at unchanged locations; zero added diagnostics. Full ESLint: 1503 to 1477, 26 removed / zero added, compared with an archived exact baseline source. Strict ESLint passes for all six changed source/test files. Five changed files pass complete Prettier; changed lines in Chat are formatted, and its five unrelated baseline differences are retained.

All 16 Messages handlers and the two annotated Chat handlers emit identical JavaScript after type erasure. Runtime differences: valid empty default history, null hover history mapping, unused default callback argument and dead props/imports removed. This is not whole-component byte identity or production/browser acceptance.

## Risks / Rollback

Graph types describe repaired client state, not validation of arbitrary server JSON. Existing repair boundaries remain. Revert this narrow source change if a consumer regresses. Browser/candidate/deployment evidence for the runtime defaults is still required; the common quality criterion remains open while full types/lint fail.

## Completion Checklist

- [x] Source checks and SDD are recorded, including the CI-driven callback/empty-preview follow-up.
- [x] Branch entry has source evidence.
- [ ] Accepted CI and exact merge receipt.
- [ ] Browser and production receipt for runtime defaults.

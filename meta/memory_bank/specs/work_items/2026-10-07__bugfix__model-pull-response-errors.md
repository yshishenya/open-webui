# Model pull response error recovery

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/model-pull-response-errors`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-model-pull-response-errors-2026-10-07-001.json`

## Root cause / callers

All pullModel callers traced: Selector.pullModelHandler and ManageOllama.pullModelHandler/updateModelsHandler. Selector catches failure with null then destructures it; all3 paths read a possibly absent response body. Update loop also announces success after a failed pull. Source-only reproduction gives4 uncaught failures/6 cases; tests must additionally reject misleading success. MoA already checks response/body and does not share these runtime defects. API tuple contract is separately reviewed in PR314; preserve it.

## Scope / acceptance

- [x] Actual three handler regressions fail before fix; cover rejection, empty-body and successful stream.
- [x] Failed/empty response settles, leaves no pool/controller entry or loading state, reports failure and never announces success.
- [x] Successful stream still updates models/clears state; connection index preserves numeric API contract.
- [x] Docker full suite and diagnostics accepted; no suppression/dependency change.
- [ ] Exact-source CI/integration and compiled-browser/production evidence accepted before completion.

## Upstream impact

Minimal native tuple fallback/body guards in two existing Svelte callers. Keep existing stream/parser/store APIs; no new runtime abstraction, dependency, schema or backend change. Changed upstream files: `src/lib/components/chat/ModelSelector/Selector.svelte` and `src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte`. Test actual handler initializers with installed TypeScript/VM pattern. Runtime change needs its own candidate/release proof; no real provider downloads in tests.

## Implementation notes

Native tuple fallbacks and optional body guards keep failures on the existing path.
The update loop records failure so it cannot announce that every model is current.
Existing Download failed key reused; missing Russian value filled with general text
that also fits existing file downloads. No new localization key/dependency.
Original actual-handler tests:6failed/3passed; first correction9/9 passed.
Extend the same regression with streamed provider error to cover update-loop failure.

## Local source acceptance

Extended original8failed/4passed; fixed15/15 includes stream error/cancellation.
Docker full706/706; full svelte-check3393→3388 errors,141warnings unchanged;
ESLint1277 unchanged;0new normalized messages (diagnostic line shifts accounted
separately). Changed-file Prettier and test ESLint pass. General G14 stays open.
Upstream impact also includes existing ru-RU Download failed translation value.
No deployment or compiled-browser acceptance claimed.

## CI rejection and minimal component cleanup

First candidate9652736ee rejected by changed-file ESLint:41 pre-existing
diagnostics in the two touched Svelte components. Remove unused imports/dead
progress assignments, use native infinite for loops and immutable caught-error
formatting, close non-void elements, retain a group role and remove obsolete
warning suppression. Fix existing undefined createModelTag display with the
already-owned createModelName. Reuse Model store type through the same minimal
Pick metadata contract already used by ModelEditor; avoid requiring full Ollama
provider payload for a selector choice. No rule disable or new dependency.
Initial type refinement revealed5caller diagnostics; correct the actual minimum
choice contract and selectedModel state before accepting a new candidate.

## Corrected source acceptance

Final minimal choice contract includes the existing arena owner. Docker changed-file
Prettier/ESLint pass; full706/706. Full diagnostics3393→3379 errors,141→131
warnings; ESLint1277→1236. No new normalized diagnostic in any file.
Compiled browser and exact-source CI remain required.

## Browser-discovered empty-stream correction

Chromium can expose a readable empty body for HTTP204. The update-all loop must
require the native Ollama success message, rather than infer completion from EOF.
An actual-handler empty200 regression fails1/18 before the correction; all18/18
and full709/709 pass afterwards. Types remain3379/131warnings with no new messages;
changed-file ESLint/Prettier pass. Browser acceptance covers HTTP204 and empty200.
The earlier c5087c3ed compiled candidate is rejected despite green CI; do not deploy.

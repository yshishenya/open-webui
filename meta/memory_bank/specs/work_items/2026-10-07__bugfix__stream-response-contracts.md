# Streaming response and cancellation tuple contracts

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/stream-response-contracts`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-stream-response-contracts-2026-10-07-001.json`

## Root cause / scope
Three existing helpers return `[Response|null, AbortController]` without a tuple
annotation, so TypeScript infers a homogeneous union array. The response and
controller positions become ambiguous in callers. Existing OpenAI and chat-stats
helpers already use the correct native tuple. Apply that same return annotation
to MoA, Ollama chat and model pull; no new runtime helper or dependency.

Trace: MoA→Chat.mergeResponses; Ollama chat has no frontend callers; model pull→
Selector.pullModelHandler and ManageOllama.updateModelsHandler/pullModelHandler.
Trace all5pair helpers; already typed OpenAI→layout/playground and stats→SyncStatsModal.
Legacy caller error/null/body issues remain independently visible; do not change
network/error behavior as part of a type-only correction.

## Acceptance
- [x] Compiler regression fails on all3 missing tuples;2correct siblings pass.
- [x] All5 typed position checks pass; emitted JavaScript of touched APIs unchanged.
- [x] Docker frontend/style/type diagnostics show a measurable reduction and no new source lines with failures; narrower existing diagnostics recorded.
- [ ] Exact-source CI/integration accepted, SDD closed; full G14 remains open.

## Upstream impact / verification
Minimal return annotations in upstream API files, one compiler-based regression
using installed TypeScript. No backend/schema/config/runtime dependency change.
Compare emitted JS and full diagnostics with the exact base; existing frontend
suite, changed-file lint/format, exact source CI. Runtime deployment is unnecessary
only if executable output is proved unchanged; preserve accepted production.

## Local verification

Compiler regression:3 failures/2 passes before,5/5 after. Full frontend suite691/691.
Both API modules emit byte-identical JavaScript under pinned TypeScript5.9.3.
Full svelte-check3396→3393 errors,141 warnings unchanged. Three pre-existing caller
locations now report the narrower null-iterator/body-null failures instead of
union-array/property errors; record textual refinements separately from new locations.
Do not suppress those failures. Follow-up: failed model pull must settle without
destructuring null, and empty-body responses must not start a reader in Selector
or either ManageOllama path. This follow-up changes runtime and requires its own proof.
No dependency upgrade: reuse the existing compiler/test graph; official5.9 release
notes and explicit compatibility/upgrade constraint are retained in dependency proof.
Production acceptance remains the terminal-file release; no deploy for erased types.

Full ESLint1277→1277,0 new messages. Changed-file ESLint clean. Same caller
source lines remain failing;2 highlighted columns move to the whole body expression.
General G14/13.11 remains open; this change does not claim a green full type/lint gate.
Frontend691/691; SDD validation0errors/0warnings; Markdown link check recorded.

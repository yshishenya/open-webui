# Describe the existing model visibility flag

## Meta

- Type: refactor
- Status: in progress
- Owner: Codex
- Branch: `codex/refactor/model-visibility-contract`
- Created:2026-10-06
- SDD Spec: N/A — one erased optional interface field, no new runtime logic or module.

## Goal and criteria

The common ModelMeta type omits hidden although model selection, notes, automation and administration read it. Existing visibility setters write booleans; readers explicitly handle absent/null metadata. Describe this existing contract without changing visibility, persistence or selection.

- [x] Existing hidden-field diagnostics are removed with zero new diagnostics.
- [x] TypeScript compilation of the API module produces identical JavaScript before and after.
- [x] Changed-file lint passes and Docker frontend tests pass.
- [ ] Exact source is committed/pushed, CI accepted and merged into airis_b2c.
- [x] Production behavior is preserved; no rebuild/restart for an erased type-only addition.

## Evidence and scope

Trace all18 source references, including workspace/admin setters, model selector, commands, pinned models, Chat and NoteEditor. Backend ModelMeta retains extra fields through existing Pydantic extra=allow. Read-only production inventory:177 model metadata records, all omit hidden; no changes. Keep the field optional and permit null consistently with readers.

## Upstream impact

One field in existing src/lib/apis/index.ts; no new helper, dependency, schema, runtime logic, settings or tests mirroring the implementation. Full typecheck against the accepted3567/158 baseline, existing frontend suite and a compilation equality assertion provide the safety net. Overall G14/13.11 remains open.

## Local verification accepted

Only `hidden?: boolean | null` is added to the existing interface. Full Docker check3567→3559 errors and158 warnings; all8 removed diagnostics concern hidden,0 added. Docker frontend567/567 tests in81 files pass. API module JavaScript is byte-identical under the lockfile-installed TypeScript5.9.3. Changed-file ESLint passes. Full Docker ESLint records1353 existing errors/0 warnings; it remains exit1. Whole-file Prettier reports the same pre-existing formatting failure before/after; no unrelated reformat. Exact-source CI/merge is still pending.

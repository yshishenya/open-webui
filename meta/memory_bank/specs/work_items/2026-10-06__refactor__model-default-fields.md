# Persisted model default fields

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: `codex/refactor/model-default-fields`
- Created: 2026-10-06

## Scope

Four erased optional fields in existing ModelMeta: skillIds/defaultFilterIds/defaultFeatureIds are string arrays; terminalId is a string. ModelEditor writes/deletes and restores these fields; Chat and backend middleware/automation consume the same persisted fields. Backend ModelMeta permits extra fields. Undefined/null variants preserve current guarded consumers. No runtime, schema, network, billing or dependency changes. This four-property interface correction is trivial; no new SDD workflow is needed.

## Measurable acceptance

- [x] Trace all field writers/loaders, Chat and server consumers.
- [x] Existing Docker frontend tests pass; full mapped diagnostics add 0 and remove the missing-field errors; lint adds 0.
- [x] API module and full client/server Chat/ModelEditor compiled output match baseline.
- [x] Commit/push and exact-source CI/merge accepted.

## Upstream impact

Four declarations in existing upstream API interface; extending its known fields avoids a parallel type or component assertions. Preserve unrelated changes and overall G14 remains open.

## Local verification

Base3c81723de5d996fb4454961afcf9f21773b4fb86 includes accepted saved-chat contract. Docker582/582 in84files. Types3514→3503,11removed/0added,158warnings. ESLint1348 unchanged,0added. Full API module JavaScript and client/server Chat/ModelEditor output identical (5comparisons). Four declarations match existing formatting; no executable or dependency changes. Full G14 remains open. Source CI/merge pending.

## Source acceptance

PR285 source`b3c0399cd2a4869e4f5ba862e7dc7fb30effa220`,merge`1ca145ffd79f06af88451a397b41395c50e9e06d`;10CI success/1expected dependency-review skip, independent CodeRabbit review skipped. Merged tree equals precomputed merge-tree; runtime/test/dependency files equal tested source. The only difference from source is two already accepted PR284 saved-chat documentation files.582/582,11type errors removed/0added,5full emit comparisons identical; no production rebuild.193/244,whole goal active.

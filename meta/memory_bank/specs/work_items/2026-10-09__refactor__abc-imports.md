# Use standard abstract collection types

Workflow: refactoring. Branch: `codex/refactor/abc-imports`.
SDD Spec: meta/sdd/specs/completed/airis-abc-imports-2026-10-09-017.json

## Goal and scope

Fresh airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicitly merge accepted63e671d2a076e56f4511c6a418c5504d96c34181 dependency. Review52 UP035 imports in51 files, replacing deprecated typing collection aliases with collections.abc and typing_extensions.Self with Python3.11 typing.Self. All imports are at module scope; no function bodies/signatures change. Preserve aliases, remaining typing names, comments and relative import execution order; leave the late Sequence import at its existing location. No new dependencies/Any or check suppression.

## Measurable acceptance

- [x] Review imported symbol uses; all454 canonical ASTs/comments preserved under exact import-only allowances.
- [x] Runtime ABC classifications and generic annotation/schema behavior match; Self identity matches; no new diagnostics; UP0350.
- [x] Runtime/API614 routes/561 paths, schemas/tools/forms/ORM/migration graph unchanged; actual fresh PostgreSQL migration and replay match.
- [x] Docker backend1025/frontend952 and Black454; unchanged frontend type/lint counts; source454/frontend1061 hashes preserved.
- [x] Primary21/production preserved;180 source SDD valid; remove only owned temporary fixtures/baseline; commit/push and prove remote SHA.

## Upstream impact and rollback

Import-only changes in51 existing modules, largely migration annotation declarations. Do not sort unrelated imports or alter runtime bodies. Python3.11-3.12 repository baseline supports these native types. Revert isolated source commit to roll back.

## Completion boundary

Focused source acceptance only. General quality, PR/CI/review/integration, clean image/browser/native/production acceptance and real mail/payment/pilot/calendar cohort remain open;198/244 unchanged. Private proof: /Users/yshishenya/.codex/private-artifacts/airis-abc-imports-20261009.

## Verified result — 2026-10-09

Application source: `df5c37236ac692c968fa5288beda3ae4077de3b6`, pushed and remote verified. Replaced52 statements/60bindings/51files,57insertions/53deletions. All454 canonical ASTs/comments match after removing exactly approved import symbols;0 function body/signature changes. Five replacement imports moved to standard-library positions; unrelated import order preserved. The late retrieval/utils.py Sequence import stays at its prior location.

Ruff690→638,52removed/0added;UP035/F401/F841 all0. Black454 passes. Native ABC predicates11families×13values,4TypeAdapter schemas,Callable arguments and Self identity pass. All11 comparison sets match: normalized runtime hints/models/tools,OpenAPI,614routes/dependencies,migration graph,forms,ORM,import failures,startup modules,final modules,stdlib behavior and actual PostgreSQL migration/replay77tables/head `o1a020261003`. Runtime captures contain525models/1050schemas/450hints/53tools/51candidate modules. Six pre-existing hint resolution errors (dispatcher,BaseModel,\_PoolManager,BaseHTTPConnection twice,Logger) are preserved, not fixed. Semantic normalization treats alias origin/arguments and None as NoneType; raw typing aliases do not have identical object identity.

Docker backend1025/frontend952 passed,0failures/errors/skips. Type2271errors/108warnings and ESLint1020 stay unchanged/red. Source454/backend and1061frontend hashes matched before/after tests. Primary21 files and production image/config/environment/mounts/neighbors/restarts preserved. Owned6-database PostgreSQL fixture used verified HostConfig.Tmpfs;removed fixture and454-file temporary baseline only after checks;0persistent volumes deleted.

Focused SDD2/2 complete;180source SDD validation required and recorded in private proof. General checks,PR/CI/integration,new clean image and production acceptance remain pending;plan198/244 unchanged.

Evidence: `source-preservation.json`, `lint-results.json`, `contract-comparison.json`, `test-acceptance.json`, `cleanup.json`, `production-preservation.json`, `primary-preservation.json`, `sdd-source-validation.json`, `source-acceptance.json` in the private proof directory. Revert only the source commit for rollback.

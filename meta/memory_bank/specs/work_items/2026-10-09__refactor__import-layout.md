# Preserve module execution while correcting import layout

Workflow: refactoring. Branch: `codex/refactor/import-layout`.
SDD Spec: meta/sdd/specs/completed/airis-import-layout-2026-10-09-042.json

## Scope and measurable acceptance

Fresh origin/airis_b2c `d579f5c02926cace8c8da60434ce1c39c7284361`;explicit accepted dependency `5e1e9fc2d019496ea0ddc1b45c393c391892cbdc`. Review86 I001 diagnostics. Apply only25 module-level fixes in25files whose first-load module sequence, imported name/alias multiset and comment sequence remain identical. Preserve all non-import AST, nested imports, function bodies and signatures. Two other fixes alter binding multiplicity,54 reorder module loading and5 are nested;they remain open for separate analysis.

- [x] Verify454 canonical AST/comments,25 binding multisets and module order;no runtime/body/signature/Any/dependency changes.
- [x] Ruff638→613,25removed/0added;Black454;runtime/OpenAPI/routes/migration/forms/ORM/import contracts and fresh PG migration/replay match before/after.
- [x] Docker backend1025/frontend952;types2271/108 andESLint1020 unchanged;454/1061 source hashes match.
- [x] Preserve primary21/production;validate181SDDs;cleanup only owned fixture/baseline;commit/push and verify final remote SHA.

## Upstream impact

Import grouping/member ordering only in25existing modules. No imports cross executable statements;no import executes in a different first-load position. Keep initial bootstrap db side-effect import and its existing comment. Existing fixtures/test suites cover runtime behavior;no product code/test abstractions or new dependency needed.

## Completion boundary

Focused source acceptance only. General checks/PR/CI/integration/clean image/browser/native/production and full mail/payment/pilot/calendar cohort acceptance remain open;plan198/244 unchanged. Private proof: `/Users/yshishenya/.codex/private-artifacts/airis-import-layout-20261009`. Revert the isolated source commit for rollback.

## Verified result — 2026-10-09

Application source `ea09c414ee445d4ec2a0883350be656aaa80d8f8` pushed and remote verified. Changes25files,15insertions/26deletions. All454 canonical ASTs/comments preserved;25first-load module sequences and imported binding multisets identical. No function body/signature changes. Existing module-level `__import__`/`__getattr__` overrides do not occur in these modules;the middleware import restriction is inside a runtime sandbox path and unchanged.

Ruff638→613,25removed/0added;61I001 remain. One existing F811 message references first `get_file_content_by_id` at781→780;both function ASTs (first and later route) remain identical and the duplicate remains a known separate issue. Comparison normalizes only this proven reference line;raw relocation proof saved. Black454 passes.

All11 contract comparisons match: runtime525models/1050schemas/621hints/53tools/62candidate modules,OpenAPI561paths,614routes/dependencies,75migration graph,70form outcomes,ORM73default tables,import failures,startup/final modules,actualPG migration/replay77tables/head o1a020261003,and real startup module execution sequence7639entries/7629distinct names. The profiler accepts only frames whose module **file** equals code filename;generated eval/exec frames are excluded. Six existing hint resolution errors are preserved.

Docker1025backend/952frontend passed without failures/errors/skips. Types2271errors/108warnings andESLint1020 remain unchanged/red. All454backend/1061frontend hashes preserved through tests. Primary21 andproduction image/config/environment/mounts/neighbors/restarts preserved;production healthy with0restarts at07:48UTC. Owned fixture6DBs used verified HostConfig.Tmpfs;removed after checks with454-file baseline;0persistent volumes deleted.

SDD2/2 complete;181source SDD validation recorded separately. PR367 at34b6e676fe9998e4da80de36a485f66c968c3753 still has no checks/jobs returned;CodeRabbit reports review disabled for this base. Do not treat that as CI passing or a live running job. This branch has no PR because general preflight remains unresolved. Full product acceptance andplan198/244 remain open.

Evidence in private proof: source-preservation.json,raw-diagnostic-relocations.json,lint-results.json,contract-comparison.json,test-acceptance.json,cleanup.json,primary-preservation.json,production-preservation.json,sdd-source-validation.json,source-acceptance.json. Rollback is the isolated source commit revert.

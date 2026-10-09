# Type and remove remaining unused bindings

Workflow: refactoring. Branch: `codex/refactor/unused-binding-types`.
SDD Spec: meta/sdd/specs/completed/airis-unused-binding-types-2026-10-09-954.json

## Goal and scope

Fresh airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicitly merge accepted31f609b9f18ccb740763654fc3fac2e3a59c44f9 dependency. Fully annotate18 previously untyped functions, review actual callers/results and remove22 unused bindings. Preserve5 evaluated expressions once, exception bodies, defaults, aliases, comments, API and data contracts. No new dependencies/Any, no diagnostic suppression. Dynamic internal context mappings use object values because they include Request/UserModel/callbacks in addition to JSON.

## Measurable acceptance

- [x] Review18 function bodies/callers and dependency/schema inference; all modified function parameters/returns annotated.
- [x] Remove22 unused bindings, preserve5 evaluations and453 canonical runtime ASTs/comments under exact reviewed allowances;0 new diagnostics, F8410.
- [x] Runtime schemas/API/dependencies/response encoding, forms/tools/ORM/migrations identical apart from reviewed annotations; focused HTTP regression and full Docker suites pass.
- [x] Black454; frontend type/lint counts unchanged; source454/frontend1061 hashes preserved; primary21/production preserved.
- [x] Validate179 SDD specs; cleanup only owned fixtures/baseline; commit/push, prove remote SHA.

## Upstream impact

Minimal annotations/imports in11 upstream modules. Four route response_model=None declarations preserve the previous absence of response validation/serialization inference; no public schema changes. Existing vector None-on-error and arbitrary parsed tool-server response remain supported. File module has two identically named handlers: change only the selected file-name route, preserve the earlier route and its endpoint reference.

## Completion boundary

Focused source acceptance only. General quality, CI/review/integration/clean image/browser/native/production and real mail/payment/pilot/calendar cohort remain open;198/244 unchanged. Revert isolated source commit to roll back. Private proof: /Users/yshishenya/.codex/private-artifacts/airis-unused-binding-types-20261009.

## Verified scope

Ruff712→690, added0, F4010/F8410. All453 existing source ASTs/comments preserved under exact22 binding removals and18 signature annotations. Four explicit response_model=None hooks preserve the previous behavior. API561 paths and614 route/dependency contracts identical. Runtime525 models/1050 schemas/53 tools, migration graph75, form cases70 and ORM73 tables unchanged; exactly18 resolved annotation entries changed as reviewed. Added8 HTTP regression cases passed on the original version before annotations.

## Full verification

1025 backend tests passed,0 failures/errors/skips (115.563s);952 frontend tests/123 files passed. The8 new HTTP cases passed before and after annotations. Black454 accepted,454 backend/1061 frontend hashes remained unchanged during tests. Type2271/108 and ESLint1020 remain unsuccessful.179 SDD files valid. Primary21 and production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 preserved at2026-10-09T07:05:47.910395 UTC. Four owned temporary PostgreSQL DBs removed; HostConfig.Tmpfs verified;0 persistent volumes deleted. Baseline453 hashes checked before removal.

## Source delivery

Application source9ca67a83bdf6ad5e11a2a4dd1108bf91ea3acc30 pushed to codex/refactor/unused-binding-types; remote SHA matches. Focused SDD2/2 complete. General quality, PR/integration, clean image and release remain pending. Plan198/244 unchanged; no numbered closure.

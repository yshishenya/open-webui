# Preserve runtime contracts while deleting unused grouped imports

Workflow: refactoring. Branch: `codex/refactor/partial-unused-imports`.
SDD Spec: meta/sdd/specs/active/airis-partial-unused-imports-2026-10-09-850.json

## Goal and scope

Reduce the measured general source-quality debt, preserving the full onboarding goal and all runtime behavior. Start from origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicitly merge accepted combined dependency4de7be1eed8788e8009c62de5e2b8f94651a373f. Overall plan remains198/244.

Review123 unused aliases across53 files. Every import declaration retains used names from the same target module. Names have no loaded AST references; direct/wildcard reexports or module-attribute consumers were not found in backend. The only reflection call in candidate files is auth.get_license_data's existing globals lookup of override_static, not the removed OFFLINE_MODE binding. First-party target modules have no **getattr**. The lazy langchain_community YoutubeLoader export needs explicit review, startup import-graph comparison and YouTube behavior checks. Optional-provider import failures must be recorded and preserved, not passed off as runtime acceptance.

## Acceptance

- [x] Remove all123 reviewed unused aliases without removing/reordering module imports; all453 ASTs/comments preserved after excluding only approved aliases and required formatting.
- [x] Before/after schemas, resolved hints, builtin tools, full OpenAPI, ORM table/index DDL and migration graph match; record module import graph and exact optional limitations.
- [x] Review lazy YoutubeLoader source/module effects; exercise actual project YoutubeLoader with mocked transcript transport and compare outcomes.
- [x] No new normalized Ruff diagnostic; Black453 passes; full backend1017/frontend952 pass and frontend check/lint do not increase.
- [x] Capture pre-test source hashes, preserve all453backend/1061frontend afterward, protected primary21 files, production and dependency/config/nativeaudio boundaries.
- [ ] Remove disposable baseline source/four PostgreSQL tmpfs databases; commit/push and prove exact final source/remote; update SDD focused tasks.
- [ ] General quality0, clean image, combined browser/native/runtime/CI/review/merge/deploy/live accepted.

## Upstream impact and rollback

Exact files/import declarations are retained privately in candidate-imports.json. The errors reside in existing upstream import statements; an additive helper cannot remove them. Delete only approved aliases; preserve all used neighbors, comments, calls, annotations, defaults, literals and import order. No new runtime dependency, data migration, API, frontend or configuration change. Revert isolated source commit to undo this cleanup.

## Verification

Docker Compose-first, existing accepted test image, read-only source during runtime/full tests, PostgreSQL data on tmpfs. Reuse contract capture and focused AST comparisons; include ORM and lazy-loader checks because aliases include model/config/sqlalchemy symbols. Optional provider modules are imported without instantiating remote clients; any absent dependency is explicit evidence, not suppressed. Full source/image/browser/native/CI/release acceptance remains separate. Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-partial-unused-imports-20261009.

## Accepted evidence

123 approved aliases removed from53 files; every target import retains used neighbors and its original order. All453 canonical ASTs and comment-token sequences match; only the reviewed alias bindings and Black whitespace differ. Black accepts453 files. Ruff1003 ->880,123 removed/0 added normalized diagnostics, remainingF401144. No unsafe fixes, suppression, dependency or frontend change.

Before/after byte-identical:525 models/1050 schemas,1414 resolved hints,53 builtin tools,561 OpenAPI paths,75 migration revisions/graph,70 actual Ollama forms, PostgreSQL column/constraint/foreign-key/index declarations for73 default ORM tables and1 OpenGauss table. All53 candidate modules loaded, import failures0; no remote vector clients were instantiated. Four existing get_type_hints NameErrors are preserved exactly and not claimed as fixed.

Default application startup module graph is byte-identical. After explicitly loading all candidates, only unused langchain_community.document_loaders.youtube is absent; no module added. The installed lazy module was read: module-level statements create definitions/constants/logger and Pydantic dataclass schemas; credential/network operations occur only inside uncalled methods. Project retrieval consumers use the project's own YoutubeLoader. Its three actual load outcomes with mocked transcript transport (success/disabled/missing) match; external transport calls0. This is not an external YouTube service test. Initial private checker expected a video ID in source metadata incorrectly; actual loader preserves the input URL. Only proof expectation corrected; rejected log retained, application unchanged for that correction.

Full Docker Compose backend1017 passed,0failures/errors/skips,107.841sec XML duration; frontend952 passed in123 files. Full check2271errors/108warnings, ESLint1020 remain unchanged and unsuccessful. All453backend/1061frontend hashes match the snapshot captured before full tests; no source edits during/after tests.

Fresh queue/preferences/success/reporting databases used tmpfs and were removed with the container. Temporary baseline source removed after checking all453 original hashes; permanent volumes deleted0.21 protected primary files preserved. Dependencies/config/nativeaudio/frontend unchanged. Production2026-10-09T05:59:39.745419UTC:c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0; image/environment/config/mounts/neighbors preserved. Deploy/SMTP/payment changes0.

All176 source SDD specs valid; initial generated0850 suffix normalized to850 and all tasks/file paths/cross-links populated before implementation. Current specification remains active; general quality/image/browser/native/CI/review/merge/release task is not complete. No new PR or CI/merge/deploy acceptance; previous PR367 observations remain tied to34b6. Overall plan198/244, new numbered closures0. Remaining144 F401 candidates in68 files are recorded for analysis, not approved for removal.

# Remove reviewed unused import statements

Workflow: refactoring. Branch: `codex/refactor/unused-import-statements`.
SDD Spec: meta/sdd/specs/completed/airis-unused-import-statements-2026-10-09-914.json

## Goal

Reduce measured source-quality debt without changing runtime behavior. Fresh origin/airis_b2c base d579f5c02926cace8c8da60434ce1c39c7284361; explicitly merge a847b8b2028a2a2d6b4b100525412e811822c99c. Overall onboarding plan198/244 and final release remain pending.

## Scope and measurable acceptance

- [x] Review144 candidates: remove135 unused bindings; explicitly preserve2 consumed reexports; retain7 internal.db initialization imports pending separate migration analysis.
- [x] Preserve all453 backend ASTs/comments except exact approved import bindings; no dependencies, settings, frontend, migrations behavior or runtime logic changes.
- [x] Compare runtime schemas/hints/tools/OpenAPI/ORM/migration graph/forms and startup graph; explicitly review any module-graph changes.
- [x] Full Docker backend1017/frontend952; Black453; no new normalized Ruff diagnostics and unchanged frontend check/lint counts.
- [x] Freeze sources before full tests, preserve primary files, remove only new fixtures/temp baseline, commit/push and prove remote SHA.

## Upstream impact and rollback

Unused imports reside in upstream-owned source. Delete exact reviewed aliases/statements; preserve adjacent comments and existing behavior. Revert isolated source commit to undo. No runtime dependency or schema change.

## Release boundary

This focused cleanup ends at source acceptance. General quality0, clean image, combined browser/native/CI/review/merge/deploy and the final onboarding criteria remain open in the combined candidate and final goal. Focused SDD does not claim those release gates.

## Accepted source evidence

135 bindings removed in61 files;2 safe_get reexports in one further file explicitly preserve compatibility and object identity. The reference audit caught these actual consumers before edits. Seven internal.db imports retain their initialization effects pending a separate migration analysis. Existing reflection accesses target request/session/plugin objects, not removed bindings. All453 ASTs/comments preserve behavior except exact reviewed import bindings and the2 explicit same-name exports; no body, call, annotation, default, literal or migration operation changed.

Ruff880 ->739:141 normalized diagnostics removed,0 added; F401144 ->7. Black453 passes. The first deletion draft left empty import separators and introducedI001; it was rejected before tests. Corrected deletion removes complete source lines, preserves import order/comments and adds no diagnostic. No broad formatter/lint fix or suppression used.

Byte-identical before/after:525 Pydantic models/1050 schemas,1392 resolved hints,53 builtin tools,561 OpenAPI paths,75 migration revisions,70 Ollama form outcomes,73 default ORM tables plus1 OpenGauss table. All52 candidate runtime modules imported without failures. Two existing hint NameErrors (JSONField.dispatcher and VectorSearchRetriever.BaseModel) are preserved. No remote vector clients instantiated.

Only5 MCP OAuth modules disappear from both default startup and forced-candidate module graphs; no modules added. Installed source reviewed: module-level definitions/constants/logger and dataclass decoration only; no client construction, transport, callback registration or authorization occurs at import. The actual project MCP transport and authentication calls/bodies remain identical. This is not a real remote MCP authorization test.

Full Docker Compose backend1017 passed,0 failures/errors/skips; frontend952 passed in123 files. All453 backend and1061 frontend hashes remain identical to the pre-test snapshot. General frontend check2271errors/108warnings and ESLint1020 unchanged; general Ruff739 remains unsuccessful. Focused source acceptance does not claim clean image, browser/native/CI, merge, deployment, pilot or final goal acceptance.

21 protected primary files preserved. Production2026-10-09T06:21:00.592591UTC remainsc0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0; image/environment/config/mounts/neighbors unchanged. No production, SMTP, payment or persistent-volume mutation. Overall plan198/244; new numbered closures0. Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-unused-import-statements-20261009.

Source commit `9a485939a72e8054a6a011a00254399579896be3` pushed; remote source verified. Disposable baseline source and the four owned PostgreSQL databases removed, permanent volumes deleted0. Compose config declares tmpfs; the private inspection incorrectly expected it in Docker Mounts, so actual mount acceptance is not claimed. Removal used the exact newly created fixture container; no other container was selected. Focused source SDD2/2 can close; integration/release remain pending.

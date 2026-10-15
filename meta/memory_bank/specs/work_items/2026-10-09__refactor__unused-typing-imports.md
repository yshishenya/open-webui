# Remove unused typing imports without changing runtime contracts

Workflow: refactoring. Branch: `codex/refactor/unused-typing-imports`.
SDD Spec: meta/sdd/specs/active/airis-unused-typing-imports-2026-10-09-836.json

## Goal and scope

Reduce the measured general quality debt on the accepted combined source while preserving behavior. Base:origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit dependency:combined candidate16e604c8ad6dda94c636cb5cd6f15ab4aa5e67ea. The full onboarding goal stays active198/244 and is not reduced to this source cleanup.

Ruff reports28 unused typing bindings in22 files. Their names have no loaded AST references; no direct/wildcard reexports were found across backend. Remove only these exact import bindings, preserving neighboring aliases and comments. Do not apply generic F401 fixes:267 other unused imports can have runtime effects. Do not change definitions, annotations, defaults, literals, calls, validation, billing/email behavior or dependencies.

## Acceptance

- [x] Remove all28 reviewed typing bindings; every backend AST matches before/after when only those import aliases are excluded; comments preserved.
- [x] Capture and compare all initialized Pydantic validation/serialization schemas, resolved annotations in all22 candidate modules, full production OpenAPI, built-in tool declarations and migration graph.
- [x] Full backend1017 and frontend952 pass; Black453 unchanged; full check/lint measured, no new normalized diagnostics.
- [x] Freeze application before full tests; preserve453 backend/1061 frontend hashes afterward, primary21 files, production and dependency/config/nativeaudio boundaries.
- [x] Remove temporary baseline source and four fresh tmpfs PostgreSQL databases after checks; delete no persistent volume.
- [x] Document, commit/push source and prove final source/remote/hash correspondence; SDD implementation/checks updated.
- [ ] General source quality0, clean image, combined browser/native/runtime, CI/review/merge/deploy/live accepted.

## Upstream impact and rollback

The22 file paths are retained in private candidate-files.json; modules span config/internal, auth/model/prompt models, external-document/perplexity definitions, routers and shared utilities. Existing import declarations are the source of the errors; a new helper would not remove unused imports. Minimal import deletion and necessary Black whitespace only. Revert the isolated source commit to undo this cleanup. No runtime dependency, configuration, API, data model or frontend change.

## Verification

Docker Compose-first using the accepted test image, read-only source during runtime/tests and disposable PostgreSQL tmpfs. Private tools reuse the existing contract capture and AST checks; runtime dependencies are not upgraded. Frontend remains the accepted combined source. Source acceptance does not imply image/native/browser/CI/release acceptance. Evidence: /Users/yshishenya/.codex/private-artifacts/airis-unused-typing-imports-20261009.

## Accepted source checks

Exactly28 unused typing bindings removed in22 files. All453 backend ASTs match after excluding only the approved typing import aliases; all453 comment-token sequences and all executable definitions/annotations/defaults/literals/control flow remain unchanged. Black accepts453 files. Ruff1034 ->1003:31 raw diagnostics removed, zero new normalized diagnostics. F811 messages are normalized only for embedded source-line numbers; UP035 collections.abc lists are compared per alias, giving34 removed normalized entries. Counts are reported separately; no diagnostics suppressed.

Before/after runtime capture explicitly loaded all22 candidate modules.525 models/1050 validation and serialization schemas,674 resolved hints,53 built-in tool declarations and561 production OpenAPI paths are byte-identical. The pre-existing JSONField NameError for dispatcher remains identical; no new hint error. All75 Alembic revision metadata/graph and70 actual Ollama form outcomes also match.

Docker Compose backend1017 passed,0failures/errors/skips,117.726sec XML duration; frontend952 passed across123 files. The entire453backend/1061frontend source snapshot was captured before full tests; source did not change during/after testing. Full frontendcheck2271errors/108warnings andESLint1020 errors remain unchanged and unsuccessful. No new dependency/config/native-audio/frontend edits.

Fresh PostgreSQL queue/preferences/success/reporting databases used tmpfs. Container and all four databases removed after acceptance; persistent volumes deleted0. Temporary baseline source removed after checking all453 original hashes.21 protected primary files preserved. Production2026-10-09T05:41:05.132829UTC:c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0;image/environment/config/mounts/neighbors unchanged. No deployment/mail/payment mutation.

Initial private checker correctly rejected a new import-spacing error after deleting Optional in prompts.py. The implementation now removes the redundant separator and preserves the accepted import order. Initial comparison also exposed line-bearing F811 text and narrowed UP035 lists; their exact documented normalization compares the same underlying diagnostics. Rejected initial output retained privately. The SDD simple template initially had no tasks; tasks/file paths and cross-links were explicitly populated before application edits. Source specs validate175/175; current SDD remains active.

No new PR/CI/merge/release acceptance. The previous combined turn's required connector observation ofPR367 remains only an observation for34b6; no check result is claimed for this new branch. A clean combined image and fresh browser/native/runtime acceptance remain mandatory after general source gates pass. Overall onboarding plan198/244, new numbered closures0.

Source91452741334c030a1c2b8846748c557dd17768a5 pushed; remote SHA verified. SDD2/3, general quality/PR/release task still pending. The following documentation-only commit preserves the tested source snapshot.

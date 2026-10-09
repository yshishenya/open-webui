# Preserve billing contracts while modernizing annotations

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/billing-model-annotations
- SDD Spec: meta/sdd/specs/active/airis-billing-model-annotation-2026-10-09-713.json
- Created: 2026-10-09

## Goal / measurable acceptance

- [x] Remove all 35 UP045/UP006 diagnostics from billing_models.py, without adding normalized Ruff diagnostics.
- [x] All five local Pydantic models have identical validation and serialization JSON schemas before/after.
- [x] Full FastAPI OpenAPI document is identical before/after.
- [x] Model validation, defaults, serialization and errors match for required, omitted optional, null optional, list and invalid input cases.
- [x] Parsed source trees are identical after canonicalizing only Optional/List annotations and deleting their now-unused typing import. SQLAlchemy declarations, numeric values, defaults, validators and application control flow are preserved.
- [x] Full backend tests pass including PostgreSQL-only scenarios in four fresh disposable databases, with zero skips/failures.
- [x] Frontend tests pass and frontend type/lint diagnostics do not increase; frontend and runtime lockfiles are unchanged.
- [x] Record proofs; commit and push source.
- [ ] Independently accept the general quality gate, PR/CI and release before closing the broader goal.

## Scope / upstream impact

Only backend/open_webui/models/billing_models.py: replace Optional[T] with T | None and List[T] with list[T], retaining defaults and field order. The module has no forward references to classes defined later. Python 3.11 supports this syntax. Removing the unused import is required to avoid adding F401 diagnostics. This Airis billing module contains the actual definitions; a helper cannot fix its existing annotations.

The branch starts from origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361 and explicitly includes the already verified formatting source b272dae751824cb123043fbfc2e4156307a58115. Neither formatting nor this change is merged. The formatting dependency is separate from this annotation diff.

## Verification / risks

Runtime annotations change representation, so AST equality alone is insufficient. Compare all model schemas and the application OpenAPI document in the same Python 3.11/Pydantic runtime, plus input validation outcomes. Run the full existing suite via isolated Docker Compose source mounts. Test databases use tmpfs and are removed after checking. No new runtime dependency, schema migration, payment, email or production operation is needed for this source block. Revert the isolated annotation commit to undo it.

Private evidence: /Users/yshishenya/.codex/private-artifacts/airis-billing-model-annotations-20261009

## Accepted evidence

- Ruff 0.16.10: 2956 -> 2920; 36 removed and zero new normalized diagnostics. The 35 annotation diagnostics and one obsolete List import diagnostic disappeared. Full Black 26.10.0: all 453 files pass. Both are the current stable development tools; runtime dependencies are unchanged.
- All ten validation/serialization schemas and all 30 validation/default/error/serialization outcomes match exactly. Full application OpenAPI with 561 paths is byte-identical. Both snapshots use Python 3.11 and PYTHONHASHSEED=0 because existing multi-method routes otherwise produce process-dependent operation IDs.
- Canonical AST identity includes all values, defaults, ORM declarations, enums and docstrings, permitting only the documented Optional/List syntax and typing import removal.
- Full backend: 1017 passed, zero failures/errors/skips, 117.40 seconds; all four PostgreSQL databases were fresh. Full frontend: 946 passed, zero failures/skips. Unchanged frontend check: 2293 errors/108 warnings; ESLint: 1020 errors. General checks remain unsuccessful and are not accepted as a release gate.
- All four PostgreSQL databases and temporary containers removed; storage was tmpfs, with no persistent volume operation. 5063 frontend/runtime dependency boundary files and 21 protected primary files are unchanged.
- Production read at 2026-10-09T04:18:17 UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, zero restarts; image, environment, configs, mounts and neighboring containers match the previous snapshot. No deployment, SMTP or financial mutation in this block.
- PR #367 exact head 34b6e676fe9998e4da80de36a485f66c968c3753 still exposes zero checks through the required connector. The cause is not established. This annotation branch has not been merged, deployed or accepted for release.

Source commit: `8c1a46abd84b8346576ad017acb0f7c69eee5b32`, pushed to `codex/refactor/billing-model-annotations`. SDD implementation/checks: 2/3; general quality/PR/release remains pending. The following documentation commit does not change executable application source.

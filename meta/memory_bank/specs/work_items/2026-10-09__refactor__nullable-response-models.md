# Preserve nullable FastAPI response contracts

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/nullable-response-models
- SDD Spec: meta/sdd/specs/active/airis-nullable-response-models-2026-10-09-0742.json
- Created: 2026-10-09

## Goal / measurable criteria

- [x] Remove all remaining 28 UP045 diagnostics without suppressions or new normalized lint diagnostics.
- [x] All 453 source trees match after canonicalizing only Optional[T] to T | None and deleting only unused Optional imports.
- [x] Full OpenAPI, initialized Pydantic schemas and tool specifications match before/after.
- [x] All 28 changed actual FastAPI response fields serialize null identically; valid and invalid response cases preserve results/errors.
- [x] Full backend tests pass with four fresh disposable PostgreSQL databases and zero skips; full frontend tests pass, type/lint counts do not increase; Black accepts all source.
- [x] Preserve frontend, dependencies, native audio verifier, protected primary changes and production.
- [ ] Record evidence, commit and push source.
- [ ] Independent full quality/PR/CI/release remains open until actually accepted.

## Scope / upstream impact

The 28 diagnostics are runtime response_model expressions in six existing routers: billing.py, channels.py, files.py, groups.py, notes.py and skills.py. Ruff offers no automatic fix. Replace the exact decorator expressions manually with Python 3.11 unions; retain handlers, authorization, paths, defaults and status codes. The actual definitions are the smallest edit point; extension hooks cannot correct these expressions. Avoid unrelated import sorting and route changes.

The branch starts from current origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361 and explicitly includes the verified dependency branch 2419f9e93d48618a622ac316a404bf397abd0926. This does not merge dependencies into integration or change frozen PR #367.

## Verification / rollback

Use the existing Python 3.11/Pydantic/FastAPI runtime and Docker Compose source mounts. Capture contracts before editing. Exercise actual APIRoute response fields through FastAPI serialization, including null, complete sample data and invalid shapes. Prove static preservation independently. Use four fresh tmpfs PostgreSQL databases for full tests and remove temporary source/data after acceptance. No deployment, SMTP or financial action is needed for this source block. Revert its isolated source commit to undo it.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-nullable-response-models-20261009


## Accepted evidence

- Six changed routers, 28 declarations; all 453 canonical source trees match. Ruff 1624 -> 1596, 28 removed, zero added; UP045 zero. Black accepts all 453 files.
- 140 cases through actual response fields: all 28 null cases and all 28 complete samples pass; invalid shapes preserve errors. OpenAPI on 561 paths, 525 model schemas, 53 tool specs and 163 resolved hints match exactly, with no hint-resolution failures in this scope.
- Backend 1017 passed, zero failures/errors/skips, 113.27 seconds; four fresh PostgreSQL databases. Frontend 946 passed; full check 2293 errors/108 warnings and ESLint 1020 remain unsuccessful, unchanged.
- Changed-file guard rejected removal of 18 existing unused Optional imports outside the six routers; all restored. Import whitespace guard caught three newly introduced blank-line diagnostics; fixed. Accepted scope preserves every neighboring import and handler.
- Temporary source directory and all four tmpfs databases removed; no persistent volume use/removal. Native audio verifier and 21 protected primary files preserved. Production 04:49:32 UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, restarts 0; image/environment/configs/mounts/neighbors unchanged. No deployment, SMTP or financial action.
- PR #367 exact head 34b6e676fe9998e4da80de36a485f66c968c3753 still exposes zero checks through the required connector; reason unestablished. Full quality, PR/CI and release are not accepted.

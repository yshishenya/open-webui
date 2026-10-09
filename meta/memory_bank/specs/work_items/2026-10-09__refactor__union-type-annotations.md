# Union type annotations

Workflow: refactoring. Branch: `codex/refactor/union-type-annotations`.
Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361. Explicit dependency: container-type-annotations 04f57d799fe162e0107dd0bd851cd53f678804f3.
SDD Spec: meta/sdd/specs/active/airis-union-type-annotations-2026-10-09-807.json

## Purpose and limits

Remove132 safe UP007 diagnostics in49 backend files.33 files are existing migration revision type declarations; revision graph and executable upgrade/downgrade bodies must be preserved. Other affected scopes include retrieval/storage hints, Ollama Pydantic inputs, auth token expiry and hostname filtering. Replace Union with PEP604 syntax and remove only newly unused Union imports in those49 files. Do not change defaults, permissions, model semantics, execution, dependencies, suppression or protected source.

## Acceptance

- [x] UP007132→0 with zero new normalized Ruff diagnostics; unsafe fixes0.
- [x] All453 canonical AST preserved; exactly49 changed files, only Union/import/Black changes.
- [x] All Pydantic schemas, builtin tools, resolved hints and production561-path API byte-identical.
- [x] Migration graph and revision metadata byte-identical; upgrade/downgrade bodies untouched.
- [x] Representative Union TypeAdapter validation/serialization, tool coercion and native Google declarations agree, no external requests.
- [x] Full backend with four fresh PostgreSQL databases and frontend pass; existing type/lint debt measured independently.
- [x] Primary21 files, native audio, frontend/dependency/config boundaries preserved; temporary sources and fixtures removed after acceptance.
- [ ] Source committed/pushed; pre-test453 hashes equal final source, SDD valid without warnings.
- [ ] General quality, CI, combined merge/source acceptance and production completed.

## Upstream impact

Mechanical type spelling changes in existing modules, minimal import removal. No new app subsystem or dependency. The canonical verifier permits Union flattening and preserves every literal, docstring, default, type comment and control-flow node. Verification scripts/evidence stay private.

## Relation to final goal

This removes mandatory G14 quality debt; the overall onboarding-retention goal remains active198/244. Real mail/Reply-To/two operators, payment/receipt, physical phone, volunteers, pilot, real24h/72h/14d windows and a mature cohort remain independent. No deployment or SMTP/financial mutation is included.

## Accepted measurements

Ruff1166→1034 (132 removed/0 new), UP007132→0; UP006/UP045 remain0. All453 canonical AST and source hashes preserved beyond the132 Union spellings/unused imports/Black whitespace;49 changed files include33 migration files. Black453/453. No executable defaults, control flow, literals, comments or migration bodies changed.

Runtime525 models/1050 schemas,53 builtin tool specs,305 resolved hints agree byte-for-byte; four pre-existing NameErrors remain unchanged.11 default candidate modules loaded; five optional vector/telemetry modules were not exercised against external services. The separately loaded75 Alembic revisions and175 module annotations agree byte-for-byte, with the same head o1a020261003 and base7e5b5dc7342b. Production OpenAPI561 paths and70 real Ollama form validation/serialization outcomes match exactly.

84 adapter cases/14 schemas across7 union types preserve branch selection, int/string/null/list/dict outcomes and validation errors;5 actual tool coercion cases preserve numeric/string/null/bool/invalid behavior. Native Google GenAI function declarations match without external requests.

Backend1017/1017,0failures/errors/skips,139.247s, four fresh PostgreSQL databases; frontend946/946. Full frontendcheck2293errors/108warnings and ESLint1020 unchanged. All453 source hashes match the frozen snapshot made before full tests; app files did not change during/after testing. Temporary baseline source and all four tmpfs databases/container removed after acceptance; persistent volumes not used/deleted. Primary21 files, native audio verifier, frontend/dependency/config boundaries preserved.

Production05:14:24UTC:c0ea,healthy,restarts0;image/ENV/config/mounts/neighbors equal prior read. Deployment/SMTP/financial changes0. Mail remains unavailable: Mac locked; no bypass or email send.

The initial private migration capture assumed the wrong alembic.ini location and was rejected. The accepted capture configures the actual existing open_webui/migrations directory explicitly. No application correction was needed.

CI was read only through the required Code Review connector with the selected yshishenya account. PR367 exact34b6 still yields checks[]/jobs[] and only skipped CodeRabbit; source workflows are present but do not prove a live run. Cause unknown. General quality, CI, review/merge, combined-source tests and deployment remain independent open gates; no new PR or numbered plan closure is claimed.

# Preserve runtime contracts while modernizing Optional annotations

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/optional-annotations
- SDD Spec: meta/sdd/specs/active/airis-optional-annotations-2026-10-09-0724.json
- Created: 2026-10-09

## Goal / measurable criteria

- [x] Apply only Ruff's existing safe UP045 fixes on Python 3.11; explicitly report remaining non-fixable diagnostics.
- [x] Every backend source tree is identical after canonicalizing only Optional[T] to T | None and removing only obsolete Optional imports.
- [x] Full FastAPI OpenAPI document and schemas of all initialized local Pydantic models match before/after.
- [x] Built-in tool specifications and resolved annotation contracts match, including argument coercion for optional integers/strings, null and booleans.
- [x] No new normalized Ruff diagnostic; all backend files pass Black with the unchanged root configuration.
- [x] Full backend suite passes on four fresh disposable PostgreSQL databases with no failures or skips; full frontend tests pass and type/lint counts do not increase.
- [x] Existing executable frontend, runtime dependencies, native audio verifier and protected primary changes are preserved.
- [ ] Save proof, commit and push source.
- [ ] General quality gate, independent PR/CI and release remain separate acceptance conditions.

## Scope / upstream impact

The branch starts from origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361 and explicitly merges the already checked formatting/billing-annotation dependency 10bfdfdcfda90f67e2277c9309ac435e5671ceb2. This does not merge either change into integration. Frozen PR #367 remains unchanged.

Ruff currently reports 1323 UP045 diagnostics in 105 files; 1295 offer safe fixes and 28 offer no fix. Limit this block to those existing safe Optional fixes, without unsafe mode, unrelated import sorting, new future imports, type aliases or dependency changes. Backend definitions contain the annotations directly, so extension hooks cannot correct them. Record the exact touched-file list and per-file preservation in private proof. Generic container/Union modernization is a later measured block.

Runtime libraries consume some annotations. Compare full API schemas, initialized Pydantic models, built-in function schemas and resolved hints in the same Python 3.11 environment. Preserve executable syntax, ORM, defaults, literal strings, validation and billing/email rules. Existing tool coercion checks get_args and must retain null/boolean behavior.

## Verification / rollback

Use the existing Docker Compose test environment with read-only source mounts for tests. Keep baseline Python source in a temporary directory only for AST comparison; remove it after checking. Capture schemas before source edits. PostgreSQL data uses tmpfs; remove test containers and databases after acceptance. No production, financial or SMTP mutations are needed for this source block. Revert its isolated source commit to undo it. Evidence: /Users/yshishenya/.codex/private-artifacts/airis-optional-annotations-20261009

## Accepted evidence

- 105 changed Python files; canonical source trees of all 453 files match. Only Optional syntax, obsolete Optional imports and required Black whitespace are permitted. Full Black accepts all 453 files.
- Ruff 2920 -> 1624: 1296 removed, zero added normalized diagnostics. UP045 1323 -> 28; all 1295 offered safe fixes applied. The 28 remaining cases are reported, not suppressed or accepted as a successful full lint gate.
- Full 561-path OpenAPI, both schemas for each of 525 initialized Pydantic models, 53 built-in tool specifications and 1593 resolved annotation targets are byte-identical. Five pre-existing get_type_hints failures remain identical and are explicitly recorded. 83 candidate modules are loaded at startup; 22 optional provider/test modules have static/compile/test evidence, without claiming external provider exercise.
- Six coercion/error scenarios preserve optional integer/string, null, boolean and invalid integer behavior. Native Google GenAI declarations for old/new optional annotations also match; zero external model/network requests.
- Initial import cleanup was rejected by the AST guard because Ruff's grouped F401 edit also removed neighboring unused List, Any and Literal imports in three files. All neighbors restored; the runnable cleanup now removes only Optional and handles duplicate imports in successive passes. No wider F401 cleanup or unsafe fix was accepted.
- Full backend: 1017 passed, zero failures/errors/skips, 118.18 seconds, all four PostgreSQL databases fresh. Full frontend: 946 passed, zero failures/skips. General frontend check 2293 errors/108 warnings; ESLint 1020 errors remain unsuccessful and unchanged.
- Four temporary databases and test containers removed; actual HostConfig.Tmpfs verified, no persistent volume use/removal. Temporary baseline source directory removed after checking; hashes, schemas, diagnostic output, XML and logs retained. Native audio verifier unchanged; 21 protected primary files unchanged.
- Production read 2026-10-09T04:36:18 UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, healthy, zero restarts; image, environment, configs, mounts and neighbors match the preceding snapshot. No deployment, SMTP or financial mutation.
- PR #367 still exposes zero checks for exact head 34b6e676fe9998e4da80de36a485f66c968c3753, including a read explicitly selecting the yshishenya account. The cause remains unestablished. No CI/merge/release acceptance is claimed.

# Apply the configured backend formatting policy

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: codex/refactor/backend-format-policy
- SDD Spec: meta/sdd/specs/active/airis-backend-format-policy-2026-10-09-652.json
- Created: 2026-10-09
- Updated: 2026-10-09

## Context

The mandatory full backend formatting command is not yet green. An earlier
check mounted backend source without the root pyproject.toml and reported 417
files. With the repository configuration, Black 26.5.1 reports 69 files. The
report must distinguish environment drift from actual source formatting debt.

## Goal / Acceptance Criteria

- [x] Run the existing Black tool at the current stable version with the unchanged repository configuration (line length 120, preserved quote style).
- [x] Full backend Black check reports zero files requiring formatting.
- [x] Every changed Python file has exactly the same parsed syntax tree, including type comments and docstrings, as the integration base.
- [x] Apply only Ruff Q000 fixes for the existing single-quote policy; preserve every literal value and all other rules. Q000 errors become zero and no new normalized Ruff diagnostics appear.
- [x] Full backend suite passes; PostgreSQL-only scenarios run against disposable databases without unresolved skips.
- [x] Full frontend suite passes; executable frontend files and lockfiles stay unchanged.
- [x] Record the source, checks and corrected earlier count; commit and push the branch.
- [ ] General quality gate and eventual PR/CI/release are accepted independently.

## Non-goals

Runtime behavior, dependencies, schema, migrations, payments, email activation,
and removal of unrelated lint/type errors. Q000 is part of the existing formatting policy. Do not touch the frozen PR #367.

## Scope / Upstream impact

Only formatter-required Python whitespace and Ruff Q000 quote delimiters in backend plus task documentation.
This broader mechanical diff is required by the explicitly listed full Black
command in the onboarding implementation plan. No imports, annotations,
names, functions or application contracts are rewritten; quote delimiters may
change while actual literal values remain identical. Prove syntax-tree
identity for every changed file rather than relying on a sample.

## Verification

Docker Compose-first, isolated source mounts and the existing test dependency
image. Current stable Black is a development tool already used by the project;
runtime dependencies and lockfiles do not change. Full Ruff is measured before
and after. PostgreSQL fixtures use temporary memory-backed data and are removed
after acceptance. Full frontend tests use the accepted dependency volume.

## Risks / Rollback

Mechanical formatting can cause upstream merge conflicts. Limit changes to
Black output under the existing policy, keep them in a separate commit, and
use syntax-tree equality and full tests. Revert the commit for rollback.
Do not report a successful formatting check as acceptance of G14.

## Evidence before quote normalization

- Correctly configured Black 26.5.1: 69 files need formatting, not 417.
- Current stable Black 26.10.0: 69 files formatted, then all 453 Python files pass.
- AST identity proved across all 453 files using the same Python interpreter; source coordinates excluded, docstrings/type comments included. Native audio check unchanged.
- Full backend including four disposable PostgreSQL databases: 1017/1017, zero failures/skips.
- Frontend 946/946; unchanged full check 2293/108 and ESLint 1020.
- Ruff 6466 -> 6456; zero new, 10 removed. Q000 contributes 3500 of the remaining errors and requires delimiter normalization under the existing rule.
- Earlier mixed-Python AST comparison was rejected; accepted comparison uses Python 3.11 consistently.

## Quote normalization verification

- Ruff Q000: 3500 fixed, zero remaining. Full Ruff 6466 -> 2956, zero added normalized diagnostics, 3510 removed.
- Black 26.10.0 accepts all 453 Python files after quote changes.
- All 453 syntax trees (same Python 3.11 interpreter, excluding source coordinates) match the integration base; 105 files changed. Literal values, docstrings and type comments are included in the comparison.
- Native audio verification source, frontend, E2E, pyproject and every runtime lockfile remain unchanged.
- Rejected rerun: 1016 passed/1 failed because a reporting test received a reused PostgreSQL database containing its user table. Recreated all four disposable databases; fresh full acceptance passed: 1017/1017, zero failures/errors/skips (97.09s). All four temporary databases were removed. No test exclusions, source guards or assertions were weakened.

## Source delivery

Application/source commit `b272dae75` was pushed to
`codex/refactor/backend-format-policy`. SDD implementation/checks: 2/3;
remaining task is the independently measured general quality/PR/release gate.
This source block is ready for review but the whole product is not accepted.

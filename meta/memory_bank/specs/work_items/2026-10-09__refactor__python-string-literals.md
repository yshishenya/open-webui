# Preserve Python string values while correcting source layout

Workflow: refactoring. Branch: `codex/refactor/python-string-literals`.
SDD Spec: meta/sdd/specs/completed/airis-python-string-literals-2026-10-09-113.json

## Scope and measurable acceptance

Fresh origin/airis_b2c `d579f5c02926cace8c8da60434ce1c39c7284361`; explicit accepted source dependency `e3eba9491755b81e7045782261dd3dc9328716c2`. Review 24 module/class assignment string values in two files covering 66 E501/W291 diagnostics. Preserve every evaluated string, including Markdown hard-break spaces and template newlines. Exclude all functions and their decorators from the edits.

- [x] Preserve all 454 canonical ASTs, comment sequences and exact function source text; zero application behavior, type hint, dependency, schema or module-loading changes.
- [x] Reduce Ruff diagnostics without new ones; Black passes. Keep source and runtime string values identical, including Unicode, escapes and significant trailing spaces.
- [x] Required Docker backend/frontend checks complete with frozen source hashes; compare remaining general type/lint diagnostics without suppressing them.
- [x] Preserve protected primary files and production; clean only owned test fixtures after verification; commit/push and verify the remote SHA.

## Implementation and upstream impact

For long triple-quoted values, use source line continuation without introducing runtime newlines; represent significant trailing spaces explicitly with `\x20`. Long single-quoted values use adjacent literal strings. Python concatenates them at compilation. Only source layout changes in `config.py` and `constants.py`. Module and class docstrings are excluded. No function body or signature is edited. The complete AST and literal-value comparisons protect all consumers without adding a new runtime helper.

Review file: private `airis-python-string-literals-20261009/reviewed-literals.json`; one runnable verifier compares all backend ASTs/comments and exact function source before/after. Existing application suites cover behavior. General quality acceptance G14/13.11, integration, candidate image and full A/B mail/payment/pilot acceptance remain open until their own criteria are satisfied.

## Delivery boundary

Source acceptance is distinct from integration and production. This work does not change the numbered onboarding plan or declare the pilot started. Revert the isolated application source commit for rollback. Do not change shared integration task state from this branch.

## Verified source acceptance — 2026-10-09

Application source: `6e88840a80d1fadedf02be89090c4352eaa3c28a`, pushed and exact remote SHA verified. Diff: two files, 137 insertions / 64 deletions. Canonical ASTs (including type comments), comments, function source text and 52,261 evaluated string values match on Docker Python 3.11.16 and 3.12.15; all 454 files compile. The host verifier also passes. A first cross-interpreter hash comparison was rejected because AST representation differs by Python version; the accepted check parses both Git baseline and changed source in the same interpreter.

Black 26.10.0: all 454 backend files unchanged. Ruff 0.16.10: 613 to 547, 66 removed (42 E501 / 24 W291), zero added by normalized filename/code/message comparison. Docker backend: 1,025 passed, zero failures/errors/skips; PostgreSQL 16 tmpfs fixture exercises queue, preferences, success and billing-reporting cases. Frontend: 952 tests / 123 files passed. Source freeze: 454 backend / 1,061 frontend hashes unchanged through checks; frontend hashes also match the accepted dependency.

General type checking remains **2,271 errors / 108 warnings**; ESLint remains **1,020 errors / zero warnings**. The real `npm run preflight` cannot run because this repository has no preflight script. The pr-creator skill requires a passing workspace preflight before PR creation; no PR is created, no checks are suppressed. G14 / 13.11 / 13.16, integration and deployment remain open.

Production was read before/after: source `c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908`, image `sha256:1dd96829dfc0189ea08d95cdc429f533580d78e6a5443214f065ae0ae008fac5`, healthy, restarts zero. Image, environment hash, configuration hashes, mounts and all 14 current neighboring containers match. The 21 protected primary tracked files match their original hashes. No production mutation was required for this isolated source change.

Owned PostgreSQL container (four databases, tmpfs only) and verified temporary Git baseline (454 files) removed after tests; existing external network and dependency cache preserved. SDD 2/2 completed. Its newly created four-digit identifier was corrected to the project's three-digit CI convention; task text now states the accepted 24/66/two-file scope.

Proof: `/Users/yshishenya/.codex/private-artifacts/airis-python-string-literals-20261009`: `verify-runtime.py`, `literal-layout.py`, `runtime-11.json`, `runtime-12.json`, `test-acceptance.json`, `lint-results.json`, `source-freeze.json`, `primary-preservation.json`, `production-preservation.json`, `backend-results.xml`, check logs and delivery receipt. Re-run runtime verification with a freshly reconstructed readonly Git baseline and the recorded interpreter; the temporary baseline itself is intentionally removed.

- [x] Isolated source change, required test runs, preservation and source delivery accepted.
- [ ] PR, integration and new production image acceptance; overall quality and full onboarding/pilot criteria remain open.

Numbered onboarding plan remains **198/244**, with **46** open items and zero new numbered closures. Final goal remains active. This formatting acceptance does not stand in for real mail delivery, replies, operator access, phone, independent usefulness, payment, voluntary pilot or mature 24h/72h/14d cohorts.

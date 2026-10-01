# Correct measured usage accounting for Responses API

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/streaming-usage-accounting
- SDD Spec: meta/sdd/specs/completed/airis-streaming-usage-2026-10-02-001.json
- Created: 2026-10-02
- Updated: 2026-10-02

## Context and root cause

A streaming Responses API completion stores measured input/output tokens in chat history, but billing records usage_missing and falls back to estimated usage. The browser requests usage and the model capability permits it. The shared billing wrapper only inspects top-level usage with Chat Completions field names. Responses API sends response.completed.response.usage with input_tokens/output_tokens. Therefore provider measurements reach the chat handler but not settlement. Ollama also calls this shared wrapper with string SSE lines; preserve both byte and string callers.

## Acceptance criteria

- [x] Reproduce the mismatch and trace all callers of the shared billing wrapper.
- [x] Add a failing Responses regression proving measured token counts, charge and is_estimated=false.
- [x] Normalize existing Chat Completions/Responses/Ollama usage through the existing helper.
- [x] Recognize only completed nested Responses usage; null/missing usage keeps explicit estimate behavior.
- [x] Preserve stream bytes/text, hold release, cancellation and existing free/paid settlement semantics.
- [x] Run focused billing tests and backend checks through Docker Compose.
- [x] Review, commit and PR to airis_b2c.
- [x] Verify the measured usage on the released runtime before closing the production defect.

## Scope

Only the shared billing usage extractor and stream wrapper, plus focused existing tests. No new dependencies, schema changes or rate changes. Historical estimates/ledger are not rewritten. Existing usage normalization is reused.

## Upstream impact

backend/open_webui/utils/billing_integration.py is fork-owned billing logic; the change stays at the shared settlement boundary. Router/frontend upstream files do not need changes. Existing router-level test exercises the real paid settlement path with a fake provider.

## Verification

Docker Compose-first pytest for billing integration, streaming, lead magnet, and related OpenAI response tests; black --check on changed files; ruff; git diff --check. One Responses regression must fail before the fix. Live acceptance uses a free model, compares the saved provider measurement with the new usage event and checks zero monetary charge. Preserve current runtime configuration and frontend when preparing a release.

## Risks and rollback

A wrong field mapping can undercount or overcount both free quota and paid usage. Keep the existing estimate marker when no measurable tokens exist. No retroactive reconciliation. Rollback retains the prior image; returning to the prior parser reintroduces estimates, so close production acceptance only after a fresh verified request.

## Source verification

Before the change, Responses and normalized-field streaming regressions failed, while Chat Completions passed. After the fix, the full backend suite passed: 418 tests. The focused free/paid/string-stream checks passed. Black with the repository configuration (120 columns, skip string normalization) and ruff on all four changed Python files passed. Repository-wide ruff still reports 6,757 existing violations. npm run preflight is unavailable in this repository; the documented Docker backend checks were used instead. SDD validation has no errors or warnings; the generated ID was normalized to the required three-digit sequence. Self-review found no outstanding correctness issue. PR #133 merged after all executing exact-head checks passed. A fresh released free completion matched saved provider input/output counts, the settled non-estimated usage event and exact free-quota deltas; monetary charge was zero and prior events were unchanged. This does not constitute a live paid transaction test.

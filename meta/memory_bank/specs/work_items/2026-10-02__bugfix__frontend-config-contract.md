# Frontend configuration contract recovery

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/frontend-config-contract
- SDD Spec: meta/sdd/specs/completed/airis-frontend-config-contract-2026-10-02-208.json
- Created: 2026-10-02

## Context

The Airis extension of `/api/config` returns OAuth provider objects, while the frontend store declares provider strings. Public authentication fields and several existing configuration fields are missing from the shared contract. The changed store also contains inherited explicit `any` declarations rejected by changed-file CI.

## Goal / Acceptance Criteria

- [x] Provider objects and public login fields agree with the backend producer.
- [x] Shared store declarations have no explicit `any`; replacements follow traced consumers.
- [x] A runnable compiler regression check rejects the old provider contract and checks valid and invalid payloads.
- [x] Docker frontend tests pass; changed-file lint and formatting pass.
- [x] Compare full strict diagnostics with the baseline and record remaining inherited failures honestly.
- [x] Type-only changes emit identical JavaScript; otherwise build and validate changed runtime.
- [x] Commit, push, PR checks and merge into airis_b2c are verified.

## Scope

Shared TypeScript contracts only; existing dependencies and backend response remain in use. No new database or environment configuration.

## Upstream impact

`src/lib/stores/index.ts` must import corrected fork-owned declarations and replace inherited untyped fields. Keep store values and runtime expressions unchanged. Additional callers will receive only necessary type annotations if concrete contracts expose local inference problems.

## Verification

Docker Compose frontend tests, pinned ESLint on touched files, Prettier, full svelte-check diagnostic comparison, and a compiler regression fixture. Backend checks are not applicable when Python and server contracts are unchanged.

## Risks / Rollback

Incorrect optionality can obscure pre-authentication behavior or expose existing callers. Trace the backend and callers, verify emitted JavaScript, and revert the source commit if needed.

## Verified implementation

- Existing TypeScript 5.9.3 from package-lock and Docker was reused. Official 5.9 release notes were reviewed; the registry currently reports 7.0.2. This task retains the established compiler/Svelte-check pairing and JavaScript compiler API used by the fixture; upgrading compiler/tooling majors is separate from a type-only contract repair. Upgrade path: verify the current Svelte-check compiler API compatibility, update both lockfiles together, and rerun compiler fixtures, full strict diagnostics and frontend tests before adopting the new compiler.
- 162/162 tests in 39 files passed in Docker. The compiler fixture accepts public and authenticated payloads, rejects scalar provider labels, numeric VK ids, scalar stop sequences and callback-valued switches; simulating the former string provider contract fails the fixture.
- Changed-file ESLint and Prettier pass, with no suppressions or rule changes. Full ESLint remains failing with1624 errors /0 warnings (before1639). Full strict check remains failing: 4796 errors /217 warnings /286 files, compared with 4876/217/287. Auth has 5 remaining errors versus29. Exact file/message comparison removed120 diagnostics and exposed40 existing unsafe assumptions or changed secondary messages; these are recorded for follow-up rather than hidden with casts.
- TypeScript output for the store is identical to the integration baseline (SHA256 `2cca33bace8a4bbdc1e8e8482db18928f7e0d38628355b948c28b6877dc002b0`). The added declaration module emits only `export {};`. No application runtime release is required.
- Backend tests, migrations and production mutations are not applicable to this type-only change. The repository has no `preflight` script; actual frontend commands above were run.

## Source acceptance

PR165 merged: https://github.com/yshishenya/open-webui/pull/165 . Source `5069af8aa2764e177843495a8ba4b5135d6512b1`, merge `d0cd7eb905716aca811a974f38255cc8d2d7ca3c`. All12 observed statuses satisfied (dependency review skipped, CodeRabbit review skipped for the base branch). Runtime remains the preceding accepted release because JavaScript did not change.

# AIRIS chat artifact contracts

- Type: bugfix
- Status: completed
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/chat-artifact-contracts`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-chat-artifact-contracts-2026-10-07-001.json`

## Cause and existing flow

getCodeBlockContents returns five fields on every path but declares object;
artifactContents is inferred as null although Chat writes iframe/svg arrays.
Trace: shared extractor -> Chat getContents -> artifactContents -> Artifacts
and Navbar Menu. Reuse the existing fork-owned frontend contracts module.

## Measurable acceptance

- [x] Reproduce baseline diagnostics and trace every writer/reader.
- [x] Correct exact extraction result and shared iframe/svg list type, without
      casts, Any, suppressions, dependencies or runtime changes.
- [x] Full frontend suite passes; extraction preserves grouping, inline HTML,
      SVG and reasoning exclusion; zero new normalized type/lint diagnostics.
- [x] Erased TS and Svelte client/server JS and CSS equal baseline.
- [x] Exact source CI and identical source/merge trees accepted into airis_b2c.
- [x] SDD closed and acceptance recorded; full G14/13.11 remains open.

## Scope and upstream impact

Type-only changes in utils/index.ts, stores/index.ts, Chat.svelte; shared ArtifactContent in fork-owned frontend-contracts.ts.
No parser, iframe behavior, template or style changes. No backend/schema,
money/quota/mail changes. No production restart for identical emitted JS/CSS.

## Verification and rollback

Existing Docker Compose dependency volume, full Vitest/check/ESLint and changed
file formatting delta. Baseline logs reused only after source/config identity
proof. Type diagnostics are the failing reproduction; runtime extraction test
protects the real five-field contract. Revert source commit if necessary.

## Local verification

Docker full frontend 800/800 in97 files; new extraction test1/1. Typecheck
3327 ->3315 errors/130 warnings; ESLint1227 unchanged, zero new normalized
messages. All five changed source/test files ESLint clean. Artifacts already accepts the
precise store array structurally and needs no modification. Nine JS and two CSS comparisons match. No new formatter
residue; Chat retains seven existing hunks, utils/index one. Installed compilers
match lock: TypeScript5.9.3/Svelte5.56.0. No dependencies changed. No preflight
script exists; equivalent project Docker checks used. Full check/lint remain
red due inherited debt; no checks suppressed or weakened. One preceding full
run failed existing funnelAnalytics signup timing test (fixed25ms wait); latest
full rerun passed. Track its stabilization separately; no retries hidden.

Backend, migration and browser rollout are inapplicable to erased annotations.
Exact source CI and merge accepted; linked SDD is closed.

CI on first source failed only because touching Artifacts exposed three existing
unused imports. Removing those imports changed compiled module imports, so that
attempt was rejected locally. The view already accepts the exact array contract:
restore its original source and keep the correction at extractor/producer/store.
No CI guard was weakened; nine JS and two CSS comparisons must still match.

The narrowed source passes CI frontend lint. SDD CI failed before validation
during installation: PyPI reported no distribution for rpds-py>=0.25.0.
This is an external package-fetch failure; the same schema/identity checks
pass locally and are not bypassed. Acceptance waits for a successful CI run.

## Final source acceptance

PR327 source `94599bc34e3a2af1eded86c2031fdead803e2e72`, merge `57682d3dfa5a352105536210e5fd475eeac6c06d`.
All 12 reported CI checks satisfied: 11 successful and dependency-review
skipped. CodeRabbit also skipped and is not an independent review. Source and
merge trees identical; 1088 frozen source/config/test files match. Full frontend
800/800, JS9/CSS2 equal, types3315/130 and lint1227; zero new diagnostics.
All five changed source/test files pass ESLint. SDD3/3 closed. Production has
not changed; full G14/13.11 and the A/B onboarding goal remain open.

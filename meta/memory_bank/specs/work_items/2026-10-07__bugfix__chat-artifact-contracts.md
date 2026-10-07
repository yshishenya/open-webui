# AIRIS chat artifact contracts

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/chat-artifact-contracts`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-chat-artifact-contracts-2026-10-07-001.json`

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
- [ ] Exact source CI and identical source/merge trees accepted into airis_b2c.
- [ ] SDD closed and acceptance recorded; full G14/13.11 remains open.

## Scope and upstream impact

Type-only changes in utils/index.ts, stores/index.ts, Chat.svelte and
Artifacts.svelte; shared ArtifactContent in fork-owned frontend-contracts.ts.
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
messages. Five changed source/test files ESLint clean; Artifacts retains three
existing unused imports. Nine JS and two CSS comparisons match. No new formatter
residue; Chat retains seven existing hunks, utils/index one. Installed compilers
match lock: TypeScript5.9.3/Svelte5.56.0. No dependencies changed. No preflight
script exists; equivalent project Docker checks used. Full check/lint remain
red due inherited debt; no checks suppressed or weakened. One preceding full
run failed existing funnelAnalytics signup timing test (fixed25ms wait); latest
full rerun passed. Track its stabilization separately; no retries hidden.

Backend, migration and browser rollout are inapplicable to erased annotations.
Exact source CI and merge still pending; SDD acceptance task remains open.

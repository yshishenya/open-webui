# AIRIS — filters when no model is selected

## Meta

- Type: bugfix
- Status: verified; CI/merge/candidate/production pending
- Owner: Codex
- Branch: codex/bugfix/empty-model-filters
- SDD Spec: meta/sdd/specs/completed/airis-empty-model-filters-2026-10-04-001.json
- Created: 2026-10-04

## Root cause

MessageInput reduces model filter lists without an initial value. selectedModels=[] throws before rendering. Both Chat callers, model selector binding, folder model IDs and stored/default selections reach the same reactive expression. IntegrationsMenu and filter labels consume its intersection. Fix once in MessageInput; no per-caller fallback. Unknown models already map to empty lists; mentions take priority only with a truthy ID.

## Goal / measurable acceptance

- [x] Actual reactive expression returns [] for zero models without throwing.
- [x] Non-empty intersection, unknown/missing filters, mention priority and empty mention ID preserve behavior.
- [x] Runnable regression fails on the frozen base and passes after the guard; full frontend passes, no new types/style diagnostics.
- [ ] Separate source/CI/merge/candidate/production receipts; do not close G14 or real pilot by this fix.

## Scope / Upstream impact

Only guard shared expression in upstream-owned src/lib/components/chat/MessageInput.svelte. Add one test that executes the actual extracted expression using installed TypeScript AST and Node VM. No helper, dependency, database, provider, quota, draft, consent or queue change. Existing installed toolchain retained under documented compatibility; separate upgrade work remains.

## Verification / risks

Docker Compose frontend suite; full types/style; strict changed-file lint; compiler tests from PR241. Build a frozen candidate, exercise both caller forms and runtime empty selection before releasing. The existing general types/style debt remains a separate open criterion.

## Verified source

Regression on frozen base fails with Reduce of empty array with no initial value. Guarded expression passes14cases in one test. Docker Compose470/470frontend in72files; focused3checks and strict changed-file ESLint pass. Full types3967/164 and ESLint1419 unchanged:exact messages0removed/0added after normalizing only guard line/indent shifts. SDD3/3 closed,validator0errors/0warnings. Backend/database unchanged; general checks retain exit1. Private artifacts:airis-empty-model-filters-20261004. Candidate and production are separate next stages.

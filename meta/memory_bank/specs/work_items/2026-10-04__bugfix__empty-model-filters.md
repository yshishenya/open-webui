# AIRIS — filters when no model is selected

## Meta

- Type: bugfix
- Status: done
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
- [x] Separate source/CI/merge/candidate/production receipts; do not close G14 or real pilot by this fix.

## Scope / Upstream impact

Only guard shared expression in upstream-owned src/lib/components/chat/MessageInput.svelte. Add one test that executes the actual extracted expression using installed TypeScript AST and Node VM. No helper, dependency, database, provider, quota, draft, consent or queue change. Existing installed toolchain retained under documented compatibility; separate upgrade work remains.

## Verification / risks

Docker Compose frontend suite; full types/style; strict changed-file lint; compiler tests from PR241. Build a frozen candidate, exercise both caller forms and runtime empty selection before releasing. The existing general types/style debt remains a separate open criterion.

## Verified source

Regression on frozen base fails with Reduce of empty array with no initial value. Guarded expression passes14cases in one test. Docker Compose470/470frontend in72files; focused3checks and strict changed-file ESLint pass. Full types3967/164 and ESLint1419 unchanged:exact messages0removed/0added after normalizing only guard line/indent shifts. SDD3/3 closed,validator0errors/0warnings. Backend/database unchanged; general checks retain exit1. Private artifacts:airis-empty-model-filters-20261004. Candidate and production are separate next stages.

## Accepted source, candidate and production — 2026-10-04

PR242 sourcecce5a05de6428ab3fd0649285f0eb6c9d9073377 / mergeac55bf8cb2e9fd7debc18d82dd5742258fc135aa accepted10:29:18UTC;10CI success/1dependency-review skip,CodeRabbit disabled for base. All7files SHA256 identical after merge. Actual MessageInput browser5scenarios:initial empty,one/two intersection,back to empty and draft preservation;0pageerrors/0modelcalls. First harness selector matched wrapper and button; corrected only the selector. Initial favicon404 is harness-only,not an application error. Compiled candidate6previews+6openings,ordinary local fixture user,real local API/SQLite,0pageerrors/modelcalls. Fixture legal marks are not consents of real people.

Production imageyshishenya/yshishenya:empty-model-filters-cce5a05de-on-history-20261004,digest2037787c5182cbd0f8a119376b63b72e5351ef5e6b9ff07aba768397428763bb. Local image5819a0b262ec3879a59c400c24f04e21971c4a707b63fcb3918cf2163d9a03b5 and remote2037787c have identical23layers/imageENV/labels;21accepted base layers retained. All4913frontend and425backendPython hashes match. Compiled counter111392024 preserved. Healthy/restarts0,14current stable neighbors and applicationENV/mailflags retained. Backup103228Z,tar/pg_restore/sha256,hard Alembic gateo1a020261003,rollback image and10GiB floor verified;10.56GiB after release. First deployment stopped before mutations because the short-lived image verification container ended;fresh stable snapshot used for retry,all guards retained. Full3-file Compose persists the new immutable image;onlyservices.airis.image changed,atomic.env mode0600,container unchanged during persistence.

Live separate IAB tab:new and existing chat render input,existing2messages,0consoleerrors/0sentmessages. Original user tabs retained;agent tab closed. Old02.10customer-names backup transferred to Mac:12files/1566157968bytes,size/SHA256 and tar/dump readability verified;remote hashes rechecked under lock before removing only that copy. Latest04.10copies062039Z/090708Z and new103228Z retained. General3967/164 types and1419ESLint/G14 remain open;real pilot and calendar/human/financial criteria are unchanged. Private receipts:airis-empty-model-filters-20261004.

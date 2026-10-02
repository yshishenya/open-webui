# Exact typing for the existing translation context

Status: Done
Owner: Codex
Branch: `codex/bugfix/frontend-verification-baseline`
SDD Spec: `meta/sdd/specs/completed/airis-frontend-context-checks-2026-10-02-205.json`

## Problem and root cause

General frontend checking reports8360 errors/224 warnings.3502 errors say the untyped i18n context cannot be used as a store. Root layout already supplies the actual writable i18next store. A specific Svelte getContext overload can reuse that exact exported type without loosening strict checking or changing runtime.

ESLint crashes inside no-unused-vars for unused Svelte ComputedVariable definitions. AST scan of all components found three with no read references: FilePreview.isTextFile, MessageInput.canCompact and ConsecutiveDetailsGroup.reasoningCount. Their expressions are pure and unused; keep the separately used toolbar/action properties. Deleting the first one resolves that crash and exposes the next. Latest parser/plugin packages reproduce the failure; upgrading is unnecessary for this repair.

## Scope and measurable acceptance

- [x] Literal i18n context infers exactly the existing store; typed generic calls keep their type and unknown keys remain unknown. Compile positive/negative assertions with existing TypeScript.
- [x] No dependency, runtime context or consent changes. Unused-reactive cleanup is a separate general lint task.
- [x] General type diagnostics no longer contain the i18n-store error. Record remaining counts; general checks must not be claimed green while debt remains.
- [x] General lint debt is measured separately: an isolated three-line deletion removes the crash and reports1708 ordinary errors. Those component edits are not part of this type-only repair; rules remain enabled.
- [x] Existing frontend tests and touched-file format/check pass; CI on exact source and accepted PR to airis_b2c.

## Dependencies and upstream impact

Use pinned Svelte5.56.0/TypeScript and existing i18next. Svelte latest stable5.57.1 and official context docs checked02.10.2026; no package upgrade or new integration is introduced. Preserve the getContext/setContext API used by this fork. Add the declaration under fork-owned utils; no upstream component changes. No reformatting or refactor. Rollback is the prior source/image; declaration is type-only.

## Evidence so far

Scratch official Node22: deleting first dead line prevents pinned8.57.0 and latest8.71.0 no-unused-vars crashes for that component. Whole parser scan has0 parse failures and exactly3 ComputedVariable findings without read references. Scratch full context check4893 errors/224 warnings/288 files versus8360/224/349; remaining general debt is open.

Strict standalone type assertions pass and fail on previous declarations (TS2344/TS18046/TS7006). All156 Vitest tests pass. Full check4893 errors/224 warnings in288 files, no i18n-store errors. Touched declarations/assertions ESLint passes. All applicable CI gates passed on exact source `a4c8faafff0a138b5eb46f018f5995c5b7f593ef`; dependency review was skipped. PR157 merged as `89c65935228434b3b136d1c73a98e61df0c4309e` on 2026-10-02. SDD3/3 completed with check-complete/complete-spec. This change affects types only; production does not need a rollout. General check/lint debt remains open.

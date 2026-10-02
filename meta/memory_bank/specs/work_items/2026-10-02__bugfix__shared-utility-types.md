# Shared utility type contracts

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/shared-utility-types
- SDD Spec: meta/sdd/specs/completed/airis-shared-utility-types-2026-10-02-212.json
- Created: 2026-10-02
- Updated: 2026-10-02

## Context / Root Cause

Strict checking loses the contracts of existing shared helpers: recursive clipboard copying has an inferred any return, image compression resolves an untyped Promise, frontmatter maps have no string index signature, and primitive helper arguments are untyped. Callers span chat responses, uploads, notes, tools, skills and billing dates.

## Goal / Acceptance Criteria

- [x] Existing callers and strict diagnostics reviewed before editing.
- [x] Changed helpers declare concrete inputs/outputs; no new any, rule suppression or dependency.
- [x] TypeScript-erased JavaScript is byte-identical after exactly three lint-only cleanups: an unused path binding/argument removed and an unreassigned array declared const.
- [x] Changed contracts compile correctly and reduce the diagnostic set, with no new caller diagnostics.
- [x] Docker frontend tests pass; strict check and lint results are recorded without claiming the remaining baseline is green.
- [x] Exact-source CI and merge into airis_b2c accepted; private plan/matrix updated.

## Implementation / Scope

Annotate existing primitive, date, text/frontmatter, clipboard, Blob and image helper contracts in `src/lib/utils/index.ts`. Retain algorithms, nullable image dimensions, clipboard fallback, DOM behavior and parser options. Reuse installed TypeScript/dayjs declarations. The one Vega renderer caller supplies two arguments, so its unused third argument is removed. OpenAPI output stays a dictionary with arbitrary schema values. Runtime validation of file size remains represented by an unknown input narrowed in its existing guards. A non-null assertion on split/pop is valid because splitting a string always returns at least one element.

## Dependency Compatibility

Registry latest TypeScript is7.0.2; repo5.9.3 remains required by the pinned typescript-eslint compatibility range (<6) and existing parser/compiler setup. A compiler upgrade requires compatible lint/parser updates and full validation as a separate work item. No dependency is introduced or replaced. Use repo-pinned TypeScript and existing DOM/dayjs declarations. Do not upgrade the compiler or parser while changing contracts; upgrades need their existing repository compatibility checks and a separate work item.

## Upstream Impact

One upstream-owned utility file receives type annotations only. Moving implementations into a fork module would enlarge the diff and duplicate existing behavior. Byte-identical emitted JavaScript apart from those three declared lint-only cleanups is a hard acceptance gate.

## Verification

- Compare TypeScript transpile output of the full before/after module.
- Check inferred exported clipboard/image/frontmatter contracts using the existing TypeScript compiler.
- Docker `npm run test:frontend` and `svelte-check --output machine`.
- Docker ESLint on changed file and full lint snapshot; compare strict diagnostics by file/message, ignoring shifted line numbers.
- Docker Prettier, work item/SDD validation, CI and exact head commit merge.

## Risks / Rollback

A narrower signature can expose real incompatible callers; compare the full diagnostic set before accepting. Keep the accepted production image unchanged during this type/lint work; final consolidated release remains a separate goal gate. Restore this source commit for type-only rollback; production configuration is unaffected.

## Current verification

Docker frontend166/166 passed; changed-file ESLint0 errors. Full strict check4730 errors/217 warnings, down from4783/217; shared module120→80 errors. No new diagnostic locations in untouched files. Two existing nullable/never-array errors show a more precise inferred specs type; their positions and causes are unchanged. The incomplete intermediate log is excluded from final counts. Compiler regression proof rejects the old clipboard any return and accepts six exported contracts. Emitted code matches after the three explicit lint cleanups; no other runtime change. Existing baseline and final consolidated runtime release remain open.

## Accepted source

PR170 accepted on b174357f60c7217df9b385d2542ff7b897eba6c4; merge118593fea32ea3aa93742fe79e71e08c1fbc8be3. All12 observed statuses satisfied, dependency review skipped; CodeRabbit review skipped rather than human-reviewed. SDD212 completed3/3. Full ESLint1621 errors/0 warnings; utility file clean. Private plan/matrix reflect the same open global checks and unchanged production.

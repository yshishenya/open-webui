# AIRIS — existing model metadata contracts

## Meta

- Type: bugfix
- Status: verified; PR/CI/merge pending
- Owner: Codex
- Branch: codex/bugfix/model-metadata-contracts
- SDD Spec: meta/sdd/specs/completed/airis-model-metadata-contracts-2026-10-04-001.json
- Created: 2026-10-04
- Updated: 2026-10-04

## Context / Root cause

The shared ModelMeta incorrectly requires an impossible never[] tool list, describes known boolean capability flags only as object and omits the existing backend chat_variables_schema. Consumers already use these values for model selection, input variables and response display. Backend models allow additional metadata; router models.add_chat_variables_schema adds fields from the existing parser. Defaults and capability controls already define twelve boolean names; usage can be absent.

## Goal / Acceptance Criteria

- [x] Existing string tool IDs, absent/null metadata, boolean flags and raw variable fields type-check.
- [x] Unknown extension capabilities and raw field values are retained; no new runtime validation or serialization is implied.
- [x] Emitted API JavaScript is byte-identical to the accepted base.
- [x] Full frontend tests pass; full diagnostic lists have zero additions; strict changed-file lint passes.
- [ ] Source/CI/merge evidence is recorded. A runtime release is unnecessary only if byte identity is proved.

## Scope / Upstream impact

Types only in src/lib/apis/index.ts. Reuse keyof DEFAULT_CAPABILITIES to avoid duplicating the supported flag names. Add a runnable compiler contract/erasure check. No component, backend, provider, dependency, persistence or migration change.

## Verification / Risks

Docker Compose full frontend tests/types/lint and strict lint. Compare against source3db735e6e's 4003 errors/164 warnings and1419 ESLint. Verify emitted runtime identity before deciding against another deployment. Incorrect types can conceal unsupported fields; inspect backend parser and every consumer first, preserve unknown extensions and test rejected numeric tool IDs/string flags. Full quality and real pilot conditions remain open.

## Verified source results — 2026-10-04

Docker Compose: 467/467 frontend tests in 70 files pass. Full types: 4003 errors/164 warnings → 3991/164; the canonical diagnostic list removes 12 and adds 0. Full ESLint: 1419 errors/0 warnings unchanged, exact JSON diagnostic comparison removes 0/adds 0. Both global commands retain exit1 because existing quality debt remains; they are not reported green. Strict API/test lint, two compiler/erasure checks, test formatting and git diff --check pass. Exact frozen API source is unchanged outside the interface and type-only import; emitted JavaScript is byte-identical. No backend, dependency or migration changed. SDD3/3 completed, validator0errors/0warnings.

Private receipts: airis-model-metadata-20261004/{type-delta.json,lint-delta.json,source-runtime-boundary-proof.json,check-exits.json}. No new runtime release is needed for an erased-type-only change. G14 and the real pilot remain open.

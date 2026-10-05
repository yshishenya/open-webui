# Existing generation parameters in chat

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: `codex/refactor/generation-parameters`
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-generation-parameters-2026-10-06-001.json

## Problem and scope

Chat and the outer control panel infer params as an empty object, while loading, editing, sending and saving concrete generation settings. Reuse the existing ModelParams and GenerationParams contracts. ModelParams must also describe the raw comma-separated stop textarea, the stored array alternative and the system prompt. Keep unknown provider-specific fields and nullable advanced defaults.

Trace Chat load, embedded creation, reset, stop conversion, stream precedence, system prompt, completion payload, autosave and draft persistence; ChatControls forwards the same object to Controls and AdvancedParams. General settings already normalize stop to an array and keep their separate GenerationParams contract. Backend ModelParams allows extra fields. No runtime algorithm, request, quota, visibility, database or dependency changes.

## Measurable acceptance

- [x] Strict compiler probe accepts empty/custom/null settings, string and array stop sequences; rejects invalid known fields.
- [x] Full Docker frontend suite passes; mapped full typecheck adds zero diagnostics and removes the concrete params diagnostics.
- [x] Complete client/server JavaScript for both changed Svelte components and API module remains byte-identical.
- [x] Changed-file lint and focused formatting pass; existing whole-application debt is measured separately.
- [x] SDD and local work item are completed; final source is pushed, exact-source CI accepted and integration tree verified before delivery is recorded.

## Upstream impact and rollback

One shared ModelParams declaration and type-only import in src/lib/apis/index.ts; type-only imports and variable annotations in Chat and ChatControls. Existing fork-owned GenerationParams is reused. Revert only these declarations on a contract regression. No production recreation is needed if all emitted JavaScript is identical. G14/13.11 and the full onboarding goal remain open until their independent criteria pass.

The inner Controls component retains its existing contract and diagnostics: its unrelated unused models export and textarea markup require a separate runtime review. This change does not touch that file or suppress its checks.

## Accepted local result

On integration603a6ed272c8aa0a5e69c88569f2a63f569970b9: strict probe4 baseline errors/0 after; Docker567/567 in81 files; full check3559→3550 errors,9 removed,0 added,158 warnings. The unchanged TerminalMenu diagnostic only reorders identical union alternatives and is retained explicitly. Full ESLint1353→1353, exact mapped messages unchanged; changed-file ESLint passes. ChatControls and the new probe are formatted; API and Chat retain prior whole-file formatting debt. All changed API/client/server JavaScript is identical under TypeScript5.9.3/Svelte5.56.0. SDD2/2 closed. npm run preflight is absent; the actual Docker checks were run directly. Exact-source CI/integration delivery accepted: PR277/sourceb16f1550bee4a77b80207d8c5d1668c36605dcb5, merge867f3bf57244fcd2312409529c3071d761cc7789; ten successful checks/one expected dependency-review skip. Expected/source/merge trees all match 3748815454140b201243b5e5427eaca69b0fba19. No production recreation was performed.

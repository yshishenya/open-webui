# Existing direct model connection contracts

## Meta

- Type: refactor
- Status: in progress
- Owner: Codex
- Branch: `codex/refactor/direct-model-connections`
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-direct-model-connections-2026-10-06-001.json

## Problem and scope

Settings stores direct connections with URL/key arrays and indexed per-endpoint configuration, but its declared type allows only null. The shared getModels loader already skips false/null/undefined; feature-flag callers pass these states. Correct the common contract rather than changing dozens of callers.

Trace all directConnections writers/readers, getModels callers, AddConnectionModal producers, per-endpoint defaults, model IDs, prefix and tags, stored unknown provider options and the direct completion handler. Reuse the existing OpenAIConfig URL/key field types. Keep server admin configuration unchanged. New types describe observed nullable defaults and preserve custom provider fields. No dependency or runtime algorithm changes.

## Measurable acceptance

- [x] Strict compiler probe accepts stored connections and all disabled states; rejects invalid URL/key arrays, model IDs and enabled flags.
- [x] Full Docker frontend suite passes; mapped full typecheck removes repeated direct connection diagnostics and introduces zero new diagnostics.
- [x] Full emitted JavaScript of every changed runtime module remains byte-identical; changed-file lint and focused formatting pass.
- [ ] Source committed and pushed; exact-source CI and merged tree accepted; SDD and branch record closed after evidence.

## Upstream impact and rollback

Reuse the existing updateOpenAIConfig parameter type without changing that module; add type-only import and parameter annotation in shared API and type-only import/Settings annotation in stores. The direct connection shape and compiler probe live in fork-owned utilities. Existing UI and network logic remain unchanged. Revert declarations only if the contract is incorrect; no production restart when JavaScript is byte-identical. G14/13.11 and the whole onboarding goal remain open.

## Local acceptance

Integration base 6f6ba848690988e8f48dac097ebe621e16d11567 has identical src to accepted PR277. Docker567/567 in81 files; typecheck3550→3526 errors,24 removed/0 added,158 warnings; full ESLint1353→1353 exact mapped diagnostics unchanged. Strict probe7 baseline diagnostics/0 after. Three changed runtime modules and unchanged OpenAI API compile to identical JavaScript. Probe and fork-owned contract formatting and changed-file lint pass. Whole-file API/stores formatting debt remains outside this type change; no suppression. SDD2/2 complete. Source CI and integration are still pending; no production restart needed for identical output.

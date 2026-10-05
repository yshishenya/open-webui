# Context usage contract and unknown limits

## Meta

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: `codex/bugfix/context-usage-contract`
- Created: 2026-10-06
- SDD Spec: meta/sdd/specs/completed/airis-context-usage-2026-10-06-001.json

## Problem and scope

Chat and MessageInput produce estimated token usage with a nullable threshold and percentage. Their inferred null-only state contradicts actual producers and the getter used by CommandSuggestionList. Describe the existing shape in the fork-owned contract and explicitly preserve unknown limits before formatting or forwarding a percentage. The mounted regression also proves that a reused getter remains stale after a renderer query update (25% instead of current 80%). Refresh context usage on query updates in the common suggestion component. Do not change the estimator, server compaction, billing or consent.

CommandSuggestionList must pass changed-file lint; replace its existing Any and unnecessary suppression with the smallest compatible declarations. Reuse child component types where needed, do not widen unrelated components.

## Measurable acceptance

- [x] Known, zero, negative and unknown limits preserve expected labels; percentage gauge preserves its existing 0–100 clamp.
- [x] Mounted slash commands accept values and getters; updates, keyboard selection and disabled actions work.
- [x] Full Docker frontend suite passes; mapped type/lint diagnostics add zero errors; changed-file lint passes.
- [ ] Full client/server output comparison identifies every executable difference; source SHA CI and merge tree accepted.
- [ ] Any executable change has separate compiled candidate and guarded production acceptance before being counted as shipped.

## Upstream impact and rollback

Minimal annotations and nullable guards in Chat, MessageInput and CommandSuggestionList; contract and checks live in Airis utilities/tests. No dependency, API or migration changes. Revert the declarations/guards for source rollback; retain immutable previous production image for release rollback. Whole onboarding quality and external acceptance remain open.

## Local verification

Docker579/579 in83 files. Full typecheck3526→3518 errors,8 removed/0 added,158 warnings. Full ESLint1353→1348,5 removed/0 added; changed-file lint passes. Complete client/server output comparison accounts for exactly the nullable guards, removed suppression comment and query-triggered getter refresh; type module output is identical. Backend and migrations untouched. Production acceptance and exact-source CI remain separate gates.

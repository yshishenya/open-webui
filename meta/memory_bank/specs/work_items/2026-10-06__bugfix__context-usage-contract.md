# Context usage contract and unknown limits

## Meta

- Type: bugfix
- Status: done
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
- [x] Full client/server output comparison identifies every executable difference; source SHA CI and merge tree accepted.
- [x] Any executable change has separate compiled candidate and guarded production acceptance before being counted as shipped.

## Upstream impact and rollback

Minimal annotations and nullable guards in Chat, MessageInput and CommandSuggestionList; contract and checks live in Airis utilities/tests. No dependency, API or migration changes. Revert the declarations/guards for source rollback; retain immutable previous production image for release rollback. Whole onboarding quality and external acceptance remain open.

## Local verification

Docker579/579 in83 files. Full typecheck3526→3518 errors,8 removed/0 added,158 warnings. Full ESLint1353→1348,5 removed/0 added; changed-file lint passes. Complete client/server output comparison accounts for exactly the nullable guards, removed suppression comment and query-triggered getter refresh; type module output is identical. Backend and migrations untouched. Exact-source CI and production acceptance are recorded below.


## Source and production acceptance

PR281 source `a498f86d765e0b9e702f8144a09c7ebe988c986c` has 10 successful checks and one expected dependency-review skip; CodeRabbit review is disabled for the base, so no independent review is claimed. Merge `e9bb03c2ebc09ef2fc18fe368b9880f2a80c1c27` has the identical source tree.

The compiled immutable candidate passed 38/38 browser scenarios in Chromium and narrow Firefox. Registry digest `sha256:9e2546496befb39906d45958daa476ff9e2b00f758f0d7f1eff75cef4f0dc25e` was released after backup/checksum/archive/pg_restore, disk, configuration and Alembic gates. All 4914 frontend and 426 Python files match the candidate. Runtime environment and 13 neighboring containers are preserved; Docker healthy, restarts0. Persistent Compose pin changes only airis.image. Public version/env/guide/captions match; Metrica111392024 is preserved. The existing authenticated chat retains history and balance0 ₽; slash commands and token-only Status were checked with no new provider request.

Whole-project G14/13.11 remains open:3518 type errors/158 warnings and1348 ESLint errors. This release does not establish external Inbox, both operators' responses, independent usefulness, real money/receipt, physical-phone or real pilot-window acceptance.

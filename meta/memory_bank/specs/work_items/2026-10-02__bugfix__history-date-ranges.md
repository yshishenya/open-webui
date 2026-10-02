# Calendar boundaries in history date groups

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/history-date-ranges
- SDD Spec: N/A (a local correction in the existing date classification helper; no new subsystem)
- Created: 2026-10-02
- Updated: 2026-10-02

## Context / Root Cause

The common history helper detects Yesterday only when month/year are unchanged. The previous calendar day at a month/year boundary is incorrectly grouped into Previous 7 days. Missing timestamps are coerced to 1970/NaN and future timestamps satisfy the previous-week inequality. All ten existing calls (seven chats API paths, notes API, ChatList and Notes) route through this helper.

## Goal / Acceptance Criteria

- [x] Trace all ten current calls and reuse the shared helper.
- [x] Reproduce month/year/leap/DST and invalid/future cases against the actual initializer.
- [x] Classify the previous local calendar day as Yesterday, including month/year/DST boundaries.
- [x] Missing/non-finite timestamps return the existing Unknown label; valid Unix epoch stays valid.
- [x] Future calendar days do not enter a previous-period group.
- [x] Preserve all other existing labels and rolling 7/30-day boundaries.
- [x] Docker tests, changed-file format/lint and exact diagnostic delta accepted.
- [ ] Source CI/merge and candidate/live acceptance recorded separately.

## Scope / Upstream Impact

`src/lib/utils/index.ts`: the existing date helper only. Add one runnable parameterized regression test. Keep caller code, database/API contracts, labels, dependencies and global checks unchanged. Use native Date calendar arithmetic for Yesterday; no date library.

## Verification

Docker Vitest: actual helper initializer and actual MONTH_NAMES extracted using existing TypeScript AST dependency, Date supplied by Vitest controlled clock. Run in Europe/Istanbul and America/New_York to cover local calendar and DST. Full Docker frontend suite and strict/lint delta against accepted PR171 code; one exact-source candidate then live immutable-file checks for deployment.

## Risks / Rollback

Unknown is an existing translated key; missing dates should no longer masquerade as historical years. Future timestamps use their normal month/year label. Revert the helper correction; no schema/configuration migration.

## Source verification

Actual former initializer: 10 failing cases and 8 passing controls. Corrected helper: 18/18 in America/New_York and Europe/Istanbul, full Docker frontend 189/189. Changed-file Prettier/ESLint passed. Full strict 4722→4721 errors, 215 warnings retained; full ESLint 1601 retained. Zero new untouched/changed-file diagnostic messages and zero new lint messages. An initial test teardown returned the Vitest utility instead of void; strict check caught it and the final teardown uses a block, with the full suite and check repeated. Notes updated_at is a required integer; its existing nanosecond conversion is preserved. Source CI/merge and deployment remain pending.

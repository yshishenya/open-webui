# Clean up the production public model catalog

## Meta

- Type: bugfix / production configuration
- Status: done
- Owner: Codex
- Branch: codex/bugfix/current-model-catalog-cleanup
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/current-public-model-catalog-c-2026-08-06-0920.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The public catalog promises current models but still exposes Qwen 3.5 Plus and Claude Sonnet 4.6, keeps inactive legacy aliases, and has a 71-entry ordering list with 63 inactive IDs.

## Goal / Acceptance Criteria

- [x] Replace Qwen 3.5 Plus with Qwen 3.7 Plus while retaining Qwen 3.8 Max as the premium tier.
- [x] Expose exactly the curated 18-model public catalog with one input and one output text rate per model.
- [x] Disable legacy model rows without deleting or rewriting chat, usage, billing, wallet, rate-card, or user data.
- [x] Set the default chat model to Qwen 3.7 Plus and rebuild ordering from active IDs only.
- [x] Take and validate backups before and after the transaction.
- [x] Verify health, catalog, pricing, provider routing, and historical chat counts after restart.

## Non-goals

- Rewriting historical chat model IDs.
- Rebuilding the application image or changing provider credentials.
- Adding dependencies, migrations, or application code.

## Scope (what changes)

- Backend: no code changes.
- Frontend: no code changes.
- Config/Env: update persisted default model, task model, and model ordering values.
- Data model / migrations: no schema changes; update existing model and rate-card rows in one ORM transaction.

## Implementation Notes

- Reuse the existing SQLAlchemy `Model`, `PricingRateCard`, `AccessGrant`, and `Config` models.
- Keep all historical rows and rate cards; use `Model.is_active=false` to remove superseded entries from the selectable catalog while preserving old-chat billing compatibility.
- Grant wildcard read access to Qwen 3.7 Plus if missing.
- Qwen 3.7 Plus text prices are 10/39 kopeks per 1k input/output tokens, rounded from the existing Qwen 3.8 Max Airis rate in proportion to current upstream prices.

## Upstream impact

- Upstream-owned files touched: none.
- Why unavoidable: N/A.
- Minimization strategy: production data/configuration only.

## Verification

- Pre-change PostgreSQL custom-format dump validated with `pg_restore --list`: `/opt/projects/.backups/airis/20260806-before-current-model-catalog-cleanup/postgres.dump`, SHA-256 `0ccccb58359fc1cba13acf562c71d6958f1319805b61a0efb1f8079cabbed5a0`.
- Post-change dump validated: `/opt/projects/.backups/airis/20260806-after-current-model-catalog-cleanup/postgres.dump`, SHA-256 `c44b62950d8c2fa0a1b7f43d8f1c9f7edd81035bbb927c984587bae3c99e175a`.
- Counts stayed stable: chats 111, chat messages 532, usage events 1108, ledger entries 585, wallets 77. Qwen 3.5 history remains in 9 distinct chats and 14 messages.
- Active models and the public rate endpoint both contain exactly the curated 18 IDs. Qwen 3.7 has one active text input card at 10 kopeks and one output card at 39 kopeks, plus wildcard read access.
- LiteLLM returned HTTP 200, `finish_reason=stop`, and visible content for a bounded `qwen3.7-plus` completion with reasoning disabled.
- `https://chat.airis.you/health` returned true; `airis` is healthy with zero restarts on image `airis:c7c200151`.
- Authenticated UI showed Qwen 3.7 Plus as the new-chat default and exactly the 18 curated choices. An old Qwen 3.5 chat still opens and asks the user to choose a current model.

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUGFIX]** Clean up production public model catalog
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__current-model-catalog-cleanup.md`
  - Owner: Codex
  - Branch: `codex/bugfix/current-model-catalog-cleanup`
  - Started: 2026-08-06
  - Summary: Replace Qwen 3.5 with Qwen 3.7, archive superseded aliases, and normalize defaults/order without touching history.
  - Tests: passed production backup validation, ORM/catalog assertions, bounded completion, health and browser smoke tests
  - Risks: incorrect rate/default configuration; controlled by one transaction and validated pre/post backups.

## Risks / Rollback

- Risks: a stale catalog ID or duplicate current rate could hide a model or produce incorrect billing.
- Rollback plan: restore the validated pre-change dump, restart `airis`, then re-run catalog and health assertions.

## Completion Checklist

- [x] `meta/tools/sdd check-complete current-public-model-catalog-c-2026-08-06-0920 --json`
- [x] `meta/tools/sdd complete-spec current-public-model-catalog-c-2026-08-06-0920 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

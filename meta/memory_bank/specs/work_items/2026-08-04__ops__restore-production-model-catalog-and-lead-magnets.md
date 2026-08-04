# Restore production model catalog and configure lead magnets

## Meta

- Type: ops
- Status: done
- Owner: Codex
- Branch: codex/bugfix/lead-magnet-access-grants-v011-20260804
- SDD Spec (JSON): `meta/sdd/specs/completed/production-model-catalog-lead-magnets-2026-08-04-001.json`
- Created: 2026-08-04
- Updated: 2026-08-04

## Context

The production container was connected to a PostgreSQL volume whose user/model/billing domain tables were empty, while a verified PostgreSQL dump from 2026-08-03 contained the live data. Model changes therefore had to be additive and reversible. The LiteLLM catalog also contained stale aliases with no healthy deployment.

## Goal / Acceptance Criteria

- [x] Preserve the live data by creating a pre-restore backup and restoring the verified dump without dropping current tables.
- [x] Add `gemini/gemini-3.5-flash-lite`, `gpt-5.6-luna`, and the cheapest working chat route `openrouter/openai/gpt-oss-20b` through LiteLLM.
- [x] Add one active input and output rate per new model using rounded kopeks (16/135, 6/36, and 1/3).
- [x] Expose the three models to normal users with public read grants and mark exactly those three as lead magnets.
- [x] Route stale public aliases to healthy LiteLLM equivalents and remove only the unavailable `gpt-5.4` public grant.
- [x] Verify public visibility, rate-card uniqueness, provider responses, billing calculations, and service health.

## Data Safety

- Source dump: `/opt/projects/.backups/airis/20260803-185252-open-webui-v0.11.0/postgres.dump`.
- Pre-restore backup: `/opt/projects/.backups/airis/20260804-before-data-restore/postgres.dump`.
- Final backup: `/opt/projects/.backups/airis/20260804-final-model-catalog/postgres.dump`.
- Restore was data-only and excluded `config`, `alembic_version`, `migratehistory`, and the incompatible empty legacy `knowledge` data; no production table was dropped.

## Verification

- PostgreSQL: 80 users, 108 chats, 90 model rows, 398 rate-card rows, 1100 usage events, and 585 ledger entries present after restore/configuration.
- LiteLLM: all 16 publicly granted model routes returned HTTP 200 with a bounded completion; stale aliases use healthy base routes.
- Normal-user ACL check: all three lead-magnet models were accessible through `AccessGrants` and the real model filtering path.
- Rate cards: no active `(model, modality, unit)` duplicates; sample 1k input + 1k output totals are 151, 42, and 4 kopeks.
- Service: `airis` is healthy on `yshishenya/yshishenya:be4f6ea84-hotfix`; `/health` returns `{"status": true}`.

## Rollback

Restore the final or pre-restore dump into an isolated database first, then follow the production database restore runbook. Do not delete the live volume or overwrite it without a fresh verified backup.

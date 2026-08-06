# Complete production model catalog, pricing, and user access

## Meta

- Type: ops/data configuration
- Status: done
- Owner: Codex
- Branch: codex/bugfix/lead-magnet-access-grants-v011-20260804
- Created: 2026-08-06
- Updated: 2026-08-06

## Goal

Complete the 15 requested LiteLLM-backed models in the live Airis catalog: activate each model, apply the rounded RUB prices as active token rate cards, and allow ordinary users to read/use each model.

## Data safety

- Pre-change backup: `/opt/projects/.backups/airis/20260806-before-model-catalog-complete/postgres.dump`
- Pre-change SHA-256: `231acc8ce72471872622c8bd83cdd27fbcd53d53d3f5f5c8981753b4a791d41e`
- Post-change backup: `/opt/projects/.backups/airis/20260806-after-model-catalog-complete/postgres.dump`
- Post-change SHA-256: `e2d08d3839f2fe1cbcb6aba92d4f494d3898c656cc7b02080bf6d532dfbec409`
- Changes were applied through the existing SQLAlchemy models in one transaction. Historical rate cards, chats, usage events, ledger entries, wallets, and users were not deleted or rewritten.

## Applied configuration

- Activated all 15 requested model rows and normalized their display names.
- Added 26 missing active text rate cards using rounded kopeks, version `2026-08-06`.
- Reused the two already-correct rate pairs for `gpt-5.6-luna` and `gemini/gemini-3.5-flash-lite`.
- Added wildcard `user:* read` grants for the 10 models that lacked them; no existing grants were removed.

## Verification

- All 15 models have `is_active=true`, exactly one active `text/token_in` and one active `text/token_out` card, and one wildcard read grant.
- ORM `PricingService` checks matched all expected prices; 1k input + 1k output sample totals range from 12 to 1800 kopeks as configured.
- Normal-user access checks returned true for all 15 models.
- Public rate-card endpoint returned all 15 requested IDs (19 models total including existing catalog entries).
- LiteLLM bounded chat completions returned HTTP 200 for all 15 exact routes.
- Production `airis` remained healthy with zero restarts; `/health` returned `{"status":true}`.
- Domain counts remained stable for users (81), chats (111), usage events (1108), ledger entries (585), and wallets (77); expected deltas were grants 17→27 and rate cards 402→428.

## Limitations

- No full frontend rebuild was run on the production host. The catalog and billing data are live database configuration; frontend image build remains a separate local-machine operation.

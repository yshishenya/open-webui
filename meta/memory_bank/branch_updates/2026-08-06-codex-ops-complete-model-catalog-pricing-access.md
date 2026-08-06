# Operations: complete model catalog pricing and access

- Spec: `meta/memory_bank/specs/work_items/2026-08-06__ops__complete-model-catalog-pricing-access.md`
- Owner: Codex
- Branch: `codex/bugfix/lead-magnet-access-grants-v011-20260804`
- Started: 2026-08-06
- Done: 2026-08-06
- Summary: Activated all 15 requested LiteLLM models, added the missing 26 token rate cards with rounded kopeks, and added wildcard read access for the 10 missing models using one ORM transaction.
- Verification: pre/post PostgreSQL backups recorded; all 15 models have exact active rates and normal-user access; public rate-card endpoint includes all 15; all 15 LiteLLM bounded completions returned HTTP 200; production health remained stable.
- Limitation: full frontend image build remains a local-machine task; no production build was run.

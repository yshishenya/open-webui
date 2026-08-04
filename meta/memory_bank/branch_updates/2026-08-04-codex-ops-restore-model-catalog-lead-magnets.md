# Operations: restore model catalog and configure lead magnets

- Spec: `meta/memory_bank/specs/work_items/2026-08-04__ops__restore-production-model-catalog-and-lead-magnets.md`
- Owner: Codex
- Branch: `codex/bugfix/lead-magnet-access-grants-v011-20260804`
- Started: 2026-08-04
- Done: 2026-08-04
- Summary: Located the verified 2026-08-03 PostgreSQL dump, backed up the current volume, restored live domain data additively, configured LiteLLM, added three working lead-magnet models/rates, and mapped stale public aliases to healthy routes.
- Verification: production container healthy; 16 publicly granted model routes returned bounded HTTP 200 completions; normal-user access checks passed; active rate-card uniqueness and deterministic pricing checks passed; final PostgreSQL backup created.
- Risks: full frontend image rebuild remains deferred because the 5.8 GiB host OOM-killed the prior build; backend hotfix image is deployed and dynamic model/billing data is live.

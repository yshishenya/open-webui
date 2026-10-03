# AIRIS observed email outcome summary

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/mail-outcome-summary
- Created: 2026-10-03
- SDD Spec: meta/sdd/specs/active/airis-complete-observed-mail-o-2026-10-03-747.json

## Goal and measurable acceptance

Add a complete read-only view of recorded mail outcomes, as the first implementation block toward plan08.09/09.07. Neither those overall criteria nor the historical eligibility requirement are closed by this block.

- [x] All six scenario types appear even with no recorded jobs; all eight states appear with observed zero counts.
- [x] Sum of states equals the exact number of observed queue jobs. Distinct accounts are separate from jobs; multiple credited payments never inflate accounts.
- [x] Suppressed/expired/failed/unknown reasons remain separate. Recorded delivery/bounce/complaint observations can overlap and never become a delivery/Inbox rate.
- [x] Only rows created by the observation cutoff and receipts dated by that cutoff contribute. States are explicitly current persisted state, not reconstructed historical state.
- [x] Historical eligible count/start and acceptance/delivery rates stay null with unavailable coverage, including when accepted is nonzero. Current opt-in does not rewrite past recorded jobs.
- [x] Controlled SQLite/PostgreSQL counts match; repeated export without changes is equal, zero DML/SMTP occurs, normal users remain unauthorized, and no addresses/content/tokens leak.
- [ ] Full backend/format/CI and frozen-image production acceptance pass; runtime settings, backup and neighboring services remain verified.

## Implementation / upstream impact

Extract the existing fork-owned mail-outcome query/model into a small helper and reuse it for existing detailed rows plus additive per-type summary. Add per-cohort and overall summaries; preserve existing response fields and registration-v1 contract. Sum distinct account counts across mutually exclusive registration cohorts. Reuse asynchronous SQLAlchemy sessions and Pydantic models. No new endpoint, scheduler changes, provider calls, schema, frontend or dependency; upstream files untouched.

## Version compatibility

Repo/runtime SQLAlchemy2.0.50 (pyproject/uv.lock and frozen container verified), runtime Pydantic2.13.4. Official SQLAlchemy2.0 asyncio guidance and2.0.50 changelog consulted. Official download on2026-10-03 lists2.1.3 current and2.0.54 maintenance: retain repo2.0.50 for this isolated read-only change, without introducing/replacing a dependency. Upgrade path is a separate locked-runtime/migration compatibility work item with full billing/PostgreSQL checks. Sources: official SQLAlchemy download,2.0 asyncio and changelog;Pydantic BaseModel documentation. No claim that repo version is latest.

## Remaining work and release prerequisite

Historical eligibility needs a separately specified durable decision journal with observation start and coverage; filtered scheduler rows cannot establish it. Do not backfill inferred history or use current eligibility as its denominator. Calendar pilot and external delivery remain separate. Current production has127 filesystem layers; next candidate must use a verified shallower build strategy and preserve runtime metadata, not add an unchecked128th layer.

## Source verification

33 focused tests passed;692 backend tests passed with3 PostgreSQL-only skips.79 relevant PostgreSQL report/queue/payment-mail checks passed. Changed-file Ruff and Black checks passed with repository settings. Existing protected API tests retain admin authorization, no-store, timeout and error handling. Controlled54-job population (nine jobs per type, two distinct accounts) conserves every status;repeat enqueue adds no duplicate;receipt cutoff/overlap, opt-out, privacy and zero DML/SMTP verified. Release acceptance remains pending;plan08.09/09.07 remain open.

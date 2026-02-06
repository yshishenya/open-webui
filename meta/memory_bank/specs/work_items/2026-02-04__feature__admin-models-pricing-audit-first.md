# Admin billing models: audit-first pricing

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-04
- Updated: 2026-02-04

## Context

`/admin/billing/models` is primarily used for auditing pricing across all models.

Models can have multiple modalities (text/image/tts/stt) with different pricing units, so we need a compact display that stays readable.

## Goal / Acceptance Criteria

- [x] Admin can audit pricing across all models.
- [x] Screen is audit-first: default focus is Text and default sorting compares prices (Input asc; missing values last).
- [x] Audit helpers: show per-focus completeness (Missing / Partial / OK) and allow filtering by Missing / Partial / Zero.
- [x] Prices are displayed in user-friendly units per modality:
  - text: input/output (per 1k tokens)
  - image: per image (image_1024)
  - tts: per 1k chars (derived from per-char)
  - stt: per minute (derived from per-second)
- [x] No backend / schema changes required.

## Non-goals

- Inline editing of prices in the table (still done via the existing modal / XLSX import/export).
- Adding new pricing units or modalities.

## Scope (what changes)

- Backend:
  - None
- Frontend:
  - Add a pricing summary column in the desktop table and the mobile cards.
  - Add focus tabs (Text / Images / Audio / All) to switch between comparable audit columns and the compact summary.
  - Add per-focus pricing completeness badge and quick filters (Missing / Partial / Zero).
  - Allow row click to open edit modal (excluding checkbox/actions).
  - Add a small Airis helper to convert rate-card units into display rates.
- Config/Env:
  - None
- Data model / migrations:
  - None

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/(app)/admin/billing/models/+page.svelte`
  - `src/lib/utils/airis/rate_cards.ts`
  - `src/lib/utils/airis/model_pricing_audit.ts`
  - `src/lib/utils/airis/model_pricing_completeness.ts`
- Pricing display mapping mirrors the public pricing API:
  - text uses raw kopeks as “per 1k tokens” (billing divides tokens by 1000)
  - tts displays `raw_cost_per_unit_kopeks * 1000`
  - stt displays `raw_cost_per_unit_kopeks * 60`

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/(app)/admin/billing/models/+page.svelte`
- Why unavoidable:
  - The table and its filters live in this page; audit-first focus controls and columns require a small template change.
- Minimization strategy:
  - Pricing logic is implemented in a new Airis utility module (`src/lib/utils/airis/rate_cards.ts`).
  - Template changes are additive and localized (focus toggle + focused columns + read-only rendering).

## Verification

- Frontend tests (Docker Compose): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/utils/airis/rate_cards.test.ts src/lib/utils/airis/model_pricing_audit.test.ts src/lib/utils/airis/model_pricing_completeness.test.ts src/lib/utils/airis/admin_billing_models_page_compile.test.ts"`

## Risks / Rollback

- Risks:
  - Minor: confusion if someone expects raw units (per token / per char / per second); mitigated via per-modality tooltips.
- Rollback plan:
  - Revert focus toggle + focused columns and remove `src/lib/utils/airis/*` helpers introduced for this feature.

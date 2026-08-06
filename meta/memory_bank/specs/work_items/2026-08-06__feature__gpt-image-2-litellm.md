# Add GPT Image 2 through the existing LiteLLM gateway

## Meta

- Type: feature / production configuration
- Status: done
- Owner: Codex
- Branch: codex/feature/gpt-image-2
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/gpt-image-2-litellm-production-2026-08-06-1236.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

Airis has an existing OpenAI-compatible image generation pipeline and billing, but production image generation is disabled and its model is unset. The current LiteLLM gateway now exposes `gpt-image-2` as an `image_generation` model.

## Goal / Acceptance Criteria

- [x] Make `gpt-image-2` selectable in the existing admin image-model list.
- [x] Configure production image generation through `https://litellm.pro-4.ru/v1/images/generations` using the existing gateway credential.
- [x] Fix generation at `1024x1024`, `quality=medium` so provider cost and Airis billing remain deterministic.
- [x] Add one active `image/image_1024` rate card at 1325 kopeks per image.
- [x] Enable image generation for users without enabling image editing.
- [x] Preserve all chats, usage events, ledger entries, wallets, files, and historical rate cards.
- [x] Verify provider generation, application configuration and UI entry point, billing rate resolution, health, logs, and public pricing.

## Non-goals

- Enabling image editing; edit input-image token costs need a separate billing design.
- Supporting variable `auto` quality or arbitrary resolutions under the current fixed `image_1024` billing unit.
- Replacing LiteLLM or creating a direct OpenAI key.

## Scope (what changes)

- Backend: add `gpt-image-2` to the existing hardcoded OpenAI-compatible image-model list and expose the configured image-only model in public pricing without activating it for text chat.
- Frontend: refresh image estimates after asynchronous rate-card loading.
- Config/Env: enable generation, select the model, set size/quality, and reuse the existing LiteLLM key in the dedicated image configuration.
- Data model / migrations: no schema changes; add a versioned rate card through the existing ORM.

## Implementation Notes

- Existing endpoint: `backend/open_webui/routers/images.py` → `/api/v1/images/generations`.
- Existing billing: `backend/open_webui/utils/airis/image_billing.py` → one proportional `image_1024` unit.
- Official medium 1024×1024 output cost is USD 0.053. Existing Airis GPT image rates consistently use 250 RUB per provider USD, producing 13.25 RUB / 1325 kopeks.
- The LiteLLM preflight generated one image successfully and returned base64 data with usage metadata.

## Upstream impact

- Upstream-owned files touched: `backend/open_webui/routers/images.py`, `backend/open_webui/routers/billing.py`, and `src/lib/components/pricing/Estimator.svelte`.
- Why unavoidable: the image catalog, public rate-card assembly, and calculator are defined in those shared files.
- Minimization strategy: one catalog entry, one configured-image exception limited to public pricing, and explicit existing reactive dependencies.

## Verification

- Direct LiteLLM `gpt-image-2` medium 1024 smoke returned HTTP 200, one base64 image, and usage metadata.
- Focused public-pricing regression test passed in an isolated Docker container; the existing image-billing test module could not initialize standalone because its legacy fixture expects `app.state.config`.
- Production image `airis:9fc818465` is `linux/amd64`; local build passed and server rootfs matched before rollout.
- Guarded backups passed SHA256, tar, and `pg_restore --list`: `/opt/backups/airis/20260806T094624Z-e284f17e8/`, `/opt/backups/airis/20260806T100914Z-ebe75f578/`, and `/opt/backups/airis/20260806T102218Z-9fc818465/`.
- Production configuration: enabled, OpenAI-compatible engine, `gpt-image-2`, `1024x1024`, `quality=medium`, LiteLLM base URL/key, editing disabled.
- One active 1325-kopeck image rate resolves publicly; historical zero/inactive and older model rates remain intact.
- Stable control counts: 82 users, 139 chats, 614 chat messages, 114 files, 78 wallets, 1192 usage events, and 700 ledger entries.
- Authenticated browser shows `Generate Image`, the 13.25 RUB public rate, and the 11.26–15.90 RUB estimate range. The signed-in wallet is 0 RUB, so a second paid application generation was intentionally not charged after the successful provider smoke.
- Final app/PostgreSQL health is healthy, restart count is zero, Alembic is `a91c0d8e4f62`, and post-deploy error logs are empty.

## Task Entry (for branch_updates/current_tasks)

- [x] **[FEATURE][IMAGES]** Add GPT Image 2 through LiteLLM
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__gpt-image-2-litellm.md`
  - Owner: Codex
  - Branch: `codex/feature/gpt-image-2`
  - Started: 2026-08-06
  - Summary: Configure deterministic GPT Image 2 generation and billing through the existing LiteLLM gateway.
  - Tests: provider smoke, focused regression, three guarded deploys, DB/config/rate assertions, health/log checks, and authenticated UI verification passed
  - Risks: production image spend and billing correctness; guarded by fixed size/quality, one transaction, and validated backups.

## Risks / Rollback

- Risks: gateway/API incompatibility, incorrect fixed price, or failure to settle usage after upload.
- Rollback plan: disable `image_generation.enable`, restore the validated pre-change dump if required, and redeploy the previous immutable image.

## Completion Checklist

- [x] `meta/tools/sdd check-complete gpt-image-2-litellm-production-2026-08-06-1236 --json`
- [x] `meta/tools/sdd complete-spec gpt-image-2-litellm-production-2026-08-06-1236 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

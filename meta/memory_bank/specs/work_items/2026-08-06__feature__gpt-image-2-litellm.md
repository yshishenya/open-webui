# Add GPT Image 2 through the existing LiteLLM gateway

## Meta

- Type: feature / production configuration
- Status: active
- Owner: Codex
- Branch: codex/feature/gpt-image-2
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/active/gpt-image-2-litellm-production-2026-08-06-1236.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

Airis has an existing OpenAI-compatible image generation pipeline and billing, but production image generation is disabled and its model is unset. The current LiteLLM gateway now exposes `gpt-image-2` as an `image_generation` model.

## Goal / Acceptance Criteria

- [ ] Make `gpt-image-2` selectable in the existing admin image-model list.
- [ ] Configure production image generation through `https://litellm.pro-4.ru/v1/images/generations` using the existing gateway credential.
- [ ] Fix generation at `1024x1024`, `quality=medium` so provider cost and Airis billing remain deterministic.
- [ ] Add one active `image/image_1024` rate card at 1325 kopeks per image.
- [ ] Enable image generation for users without enabling image editing.
- [ ] Preserve all chats, usage events, ledger entries, wallets, files, and historical rate cards.
- [ ] Verify provider generation, application generation/upload, billing settlement, health, logs, and authenticated UI.

## Non-goals

- Enabling image editing; edit input-image token costs need a separate billing design.
- Supporting variable `auto` quality or arbitrary resolutions under the current fixed `image_1024` billing unit.
- Replacing LiteLLM or creating a direct OpenAI key.

## Scope (what changes)

- Backend: add `gpt-image-2` to the existing hardcoded OpenAI-compatible image-model list.
- Frontend: no code changes.
- Config/Env: enable generation, select the model, set size/quality, and reuse the existing LiteLLM key in the dedicated image configuration.
- Data model / migrations: no schema changes; add a versioned rate card through the existing ORM.

## Implementation Notes

- Existing endpoint: `backend/open_webui/routers/images.py` → `/api/v1/images/generations`.
- Existing billing: `backend/open_webui/utils/airis/image_billing.py` → one proportional `image_1024` unit.
- Official medium 1024×1024 output cost is USD 0.053. Existing Airis GPT image rates consistently use 250 RUB per provider USD, producing 13.25 RUB / 1325 kopeks.
- The LiteLLM preflight generated one image successfully and returned base64 data with usage metadata.

## Upstream impact

- Upstream-owned files touched: `backend/open_webui/routers/images.py`.
- Why unavoidable: the OpenAI image-model list is currently defined inline there.
- Minimization strategy: one additive catalog entry; no routing or API behavior changes.

## Verification

- Focused backend route/billing tests and Python syntax check.
- Local `linux/amd64` image build only if the one-line catalog change requires deployment.
- Validated PostgreSQL backups before and after production configuration.
- Direct LiteLLM and authenticated Airis image-generation smoke tests.
- Database assertions for rate, usage, ledger settlement, and stable domain counts.
- Container/domain health and post-deploy logs.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[FEATURE][IMAGES]** Add GPT Image 2 through LiteLLM
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__gpt-image-2-litellm.md`
  - Owner: Codex
  - Branch: `codex/feature/gpt-image-2`
  - Started: 2026-08-06
  - Summary: Configure deterministic GPT Image 2 generation and billing through the existing LiteLLM gateway.
  - Tests: provider preflight passed; application, billing, build, deploy, and UI verification pending
  - Risks: production image spend and billing correctness; guarded by fixed size/quality, one transaction, and validated backups.

## Risks / Rollback

- Risks: gateway/API incompatibility, incorrect fixed price, or failure to settle usage after upload.
- Rollback plan: disable `image_generation.enable`, restore the validated pre-change dump if required, and redeploy the previous immutable image.

## Completion Checklist

- [ ] `meta/tools/sdd check-complete gpt-image-2-litellm-production-2026-08-06-1236 --json`
- [ ] `meta/tools/sdd complete-spec gpt-image-2-litellm-production-2026-08-06-1236 --json`
- [ ] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

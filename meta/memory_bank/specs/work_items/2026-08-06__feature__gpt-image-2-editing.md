# Enable GPT Image 2 editing through LiteLLM

## Meta

- Type: feature / production configuration
- Status: done
- Owner: Codex
- Branch: codex/feature/gpt-image-2
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/gpt-image-2-edit-billing-and-p-2026-08-06-1339.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

GPT Image 2 generation is active through LiteLLM, but editing remains disabled. The existing edit route charges only the generated output image and ignores provider-reported input image/text tokens, so enabling it unchanged would undercharge wallet usage.

## Goal / Acceptance Criteria

- [x] Route edits to `gpt-image-2` through the existing LiteLLM base URL and credential.
- [x] Fix edit output at `1024x1024`, `quality=medium` for deterministic output cost.
- [x] Hold a conservative amount before the provider call and settle from provider `usage` when available.
- [x] Preserve existing generation billing and non-OpenAI edit engines.
- [x] Enable editing only after provider, billing, backup, migration, health, log, and UI checks pass.
- [x] Preserve all production database rows and persistent volumes.

## Non-goals

- A new image editor UI; Airis already exposes image editing through chat tools and the image playground.
- A new payment unit or schema migration; reuse the active `image/image_1024` rate and record token details in the existing usage event.
- A direct OpenAI key or replacement of LiteLLM.

## Scope (what changes)

- Backend:
  - extend the fork-owned image billing helper with GPT Image 2 edit usage conversion;
  - pass provider usage to settlement and reuse existing OpenAI image params for deterministic quality;
  - validate/estimate loaded edit inputs before placing the wallet hold.
- Frontend: no new UI; verify existing chat/playground edit surfaces.
- Config/Env: set the existing edit engine/model/size/base URL/key records and enable the feature.
- Data model / migrations: none.

## Implementation Notes

- Official prices per 1M tokens: image input USD 8, text input USD 5, image output USD 30.
- Official medium `1024x1024` output reference cost: USD 0.053, matching the active 1325-kopeck `image_1024` rate.
- Real LiteLLM edit smoke usage: 1024 image-input, 21 text-input, 1756 image-output tokens; HTTP 200.
- The preflight estimate uses decoded input dimensions and a conservative text estimate; settlement uses provider usage and falls back to the preflight estimate when usage is absent.

## Upstream impact

- Upstream-owned files touched: `backend/open_webui/routers/images.py` and its focused billing test.
- Why unavoidable: provider response parsing and multipart edit payload are implemented in the shared image router.
- Minimization strategy: all pricing math remains in `backend/open_webui/utils/airis/image_billing.py`; the router change is a thin hook.

## Verification

- Focused Docker test: `test_image_billing.py` passed; Black, Python compilation, focused Ruff, and diff checks passed.
- Existing router integration tests stop in their pre-existing `app.state.config` test-harness setup before request execution.
- Real LiteLLM edit smoke returned HTTP 200 with provider usage and one base64 image; credential remained redacted.
- Built `airis:6d12ecccc` for `linux/amd64`; transferred rootfs matched the local image.
- Guarded backup `/opt/backups/airis/20260806T110357Z-6d12ecccc` passed SHA-256, tar listing, and `pg_restore --list` checks.
- Production Alembic is `a91c0d8e4f62`; container is healthy with zero restarts and no new error logs.
- Production counts remained 82 users, 139 chats, 614 messages, 114 files, 78 wallets, 1192 usage events, and 700 ledger entries.
- Authenticated UI loaded without console errors; a second paid edit was deliberately skipped because the real provider smoke had already passed.

## Task Entry (for branch_updates/current_tasks)

- [x] **[FEATURE][IMAGES][BILLING]** Enable GPT Image 2 editing through LiteLLM
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__gpt-image-2-editing.md`
  - Owner: Codex
  - Branch: `codex/feature/gpt-image-2`
  - Started: 2026-08-06
  - Summary: Enable deterministic image editing while charging provider-reported input and output usage through the existing wallet rate.
  - Tests: focused billing test; Black/py_compile/Ruff; real LiteLLM edit; immutable-image/rootfs; backup/Alembic/health/log/data/UI checks.
  - Risks: provider spend and wallet correctness; guarded by conservative holds, exact usage settlement, verified backup, and rollback.
  - Done: 2026-08-06

## Risks / Rollback

- Risks: underestimated hold, missing provider usage, provider/API incompatibility, or short app-container restart.
- Rollback plan: disable `images.edit.enable`, retain existing generation configuration and data, and redeploy the previous immutable image. No database downgrade is required.

## Completion Checklist

- [x] `meta/tools/sdd check-complete gpt-image-2-edit-billing-and-p-2026-08-06-1339 --json`
- [x] `meta/tools/sdd complete-spec gpt-image-2-edit-billing-and-p-2026-08-06-1339 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

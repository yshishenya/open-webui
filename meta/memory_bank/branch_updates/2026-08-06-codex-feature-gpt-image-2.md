# Branch Updates: codex/feature/gpt-image-2

## In Progress

- [ ] **[FEATURE][IMAGES][BILLING]** Enable GPT Image 2 editing through LiteLLM
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__gpt-image-2-editing.md`
  - Owner: Codex
  - Branch: `codex/feature/gpt-image-2`
  - Started: 2026-08-06
  - Summary: Enable deterministic image editing while charging provider-reported input and output usage through the existing wallet rate.
  - Tests: in progress
  - Risks: provider spend and wallet correctness; guarded by conservative holds, exact usage settlement, verified backup, and rollback.

## Done

- [x] **[FEATURE][IMAGES]** Add GPT Image 2 through LiteLLM
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__gpt-image-2-litellm.md`
  - Owner: Codex
  - Branch: `codex/feature/gpt-image-2`
  - Started: 2026-08-06
  - Summary: Added deterministic GPT Image 2 generation through LiteLLM, a 13.25 RUB rate, public pricing/calculator support, and guarded production deployment.
  - Tests: real provider smoke; focused pricing regression; `linux/amd64` build; verified backups/rootfs/Alembic; stable DB counts; healthy containers; authenticated UI and public pricing checks.
  - Risks: production image spend and billing correctness; guarded by fixed size/quality, one transaction, and validated backups.
  - Done: 2026-08-06

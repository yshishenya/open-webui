# Branch updates: codex/feature/landing-airis-refinement

## Active

- None.

## Done

- [x] **[UI]** Refine `/welcome` around the Airis brand and verified multi-model USP
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__welcome-airis-brand-refinement.md`
  - Owner: Codex
  - Branch: `codex/feature/landing-airis-refinement`
  - Started: 2026-08-06
  - Done: 2026-08-06
  - Summary: Replace the white lower-page canvas with an airy Airis violet story, strengthen the without-VPN and multi-model positioning, and preserve product-first interactions without unsupported claims.
  - Tests: 96 frontend tests, targeted ESLint/Svelte checks, production build, and in-app Browser interaction/visual QA passed.
  - Risks: Public model/quota APIs can be unavailable; content must degrade without broken or misleading states.

- [x] **[BUG]** Recover cleanly from temporary legal API gateway responses
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__bugfix__legal-api-gateway-response.md`
  - Owner: Codex
  - Branch: `codex/feature/landing-airis-refinement`
  - Started: 2026-08-06
  - Done: 2026-08-06
  - Summary: Retry temporary legal API failures once and replace duplicate technical errors with one actionable Russian message.
  - Tests: Legal API regression tests passed; fail-closed gate verified in the in-app Browser.
  - Risks: The client cannot repair an extended upstream outage; the legal gate must remain closed.

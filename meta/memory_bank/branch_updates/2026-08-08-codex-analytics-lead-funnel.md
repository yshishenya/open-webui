### In Progress

- [ ] **[ANALYTICS][LANDING][DEPLOY]** Make the lead funnel measurable and ensure production embeds analytics IDs
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__feature__analytics-lead-funnel.md`
  - Owner: Codex
  - Branch: `codex/analytics-lead-funnel`
  - Started: 2026-08-08
  - Summary: Fix missing production Metrica build ID, preserve campaign attribution, normalize funnel goals, and verify the signup-to-first-chat path in production.
  - Tests: Pending implementation
  - Risks: Medium; analytics-only changes plus deploy build args, no billing logic changes.

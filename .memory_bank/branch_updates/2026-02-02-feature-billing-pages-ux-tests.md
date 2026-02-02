# Branch Updates: feature/billing-pages-ux-tests

- [ ] **[QA]** Add billing UX tests (unit + e2e)

  - Unit: UnifiedTimeline URL filter sync
  - Unit: Wallet advanced settings auto-expand logic
  - E2E: Wallet hero + advanced collapse + history navigation smoke
  - Note: vitest config now includes SvelteKit plugin + browser conditions for client mounts
  - **Owner**: Codex
  - **Status**: In Progress
  - **Started**: 2026-02-02

- [ ] **[DEV]** Improve OpenCode (Codex) model + agent ergonomics
  - Set global default model to `openai/gpt-5.2` with variants (fast/codex/deep)
  - Add global agents: `review` (read-only), `debug` (bash+read), `docs` (no bash)
  - Add per-project commands under `.opencode/commands/` for workflow/triage/tests
  - **Owner**: Codex
  - **Status**: In Progress
  - **Started**: 2026-02-02

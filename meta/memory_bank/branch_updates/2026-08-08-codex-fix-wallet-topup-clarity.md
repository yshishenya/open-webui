### Done

- [x] **[BUG]** Harden public landing SSR, navigation, and analytics
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__landing-ssr-analytics.md`
  - Owner: Codex
  - Branch: `codex/fix-wallet-topup-clarity`
  - Done: 2026-08-08
  - Summary: Public pages are crawlable and robust during SSR, CTA intent is preserved, and duplicate Yandex page views are removed.
  - Tests: Selected Vitest suite (18 passed), production build, Playwright public-route/CTA/analytics probes.
  - Risks: Full `svelte-check` remains red on pre-existing unrelated upstream diagnostics.

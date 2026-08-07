### Done

- [x] **[BUG]** Serve prerendered landing HTML on production
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__serve-prerendered-landing-pages.md`
  - Owner: Codex
  - Branch: `codex/fix-wallet-topup-clarity`
  - Done: 2026-08-08
  - Summary: Backend now resolves adapter-static route HTML before the SPA fallback so direct landing requests receive real prerendered content.
  - Tests: Production smoke check pending redeploy
  - Risks: N/A

- [x] **[BUG]** Harden public landing SSR, navigation, and analytics
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__bugfix__landing-ssr-analytics.md`
  - Owner: Codex
  - Branch: `codex/fix-wallet-topup-clarity`
  - Done: 2026-08-08
  - Summary: Public pages are crawlable and robust during SSR, CTA intent is preserved, and duplicate Yandex page views are removed.
  - Tests: Selected Vitest suite (18 passed), production build, Playwright public-route/CTA/analytics probes.
  - Risks: Full `svelte-check` remains red on pre-existing unrelated upstream diagnostics.

### Done

- [x] **[UI][BILLING]** Simplify wallet balance and transaction history
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__billing-balance-history-simplify.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Summary: Reduce billing visual density while preserving top-up, balance, free-limit, advanced-settings, and history behavior.
  - Tests: `npm run test:frontend -- --run` (27 files, 104 tests); production browser smoke and filter regression passed with zero console errors.
  - Risks: Shared timeline markup changes wallet preview and history presentation; covered by focused tests and browser QA.

- [x] **[REFACTOR][UI][PUBLIC]** Replace misleading company page with a factual Airis project page
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__public-about-project-page.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Done: 2026-08-07
  - Summary: Rewrote `/about` as a concise project explanation, removed unsupported company claims, and renamed shared navigation labels to `О проекте` while keeping the URL stable.
  - Tests: `git diff --check`; targeted frontend lint; production `/about` route smoke after deployment.
  - Risks: Low (copy and shared labels only; no API or auth behavior changed).

- [x] **[REFACTOR][BRAND][UI]** Clean old Open WebUI branding and links from the Airis interface
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__airis-brand-cleanup.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Done: 2026-08-07
  - Summary: Replace user-facing Open WebUI/AIris branding with Airis and remove old upstream website/GitHub destinations while preserving compatibility identifiers.
  - Tests: Locale JSON parse, `git diff --check`, and frontend tests passed (27 files, 104 tests); type/lint checks blocked by existing errors.
  - Risks: Medium (mechanical updates span locale files and shared settings screens).

### In progress

- [x] **[FEATURE][ANALYTICS][YANDEX]** Expand privacy-safe analytics to ecommerce, canonical landing conversion, and product engagement signals
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__yandex-analytics-depth.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Done: 2026-08-07
  - Summary: Complete the Yandex-only funnel picture with dataLayer purchases, canonical CTA goals, scroll depth, and activation signals.
  - Tests: 5 focused Vitest tests passed; `npm run check`; `npm run build:vite`; targeted ESLint; `git diff --check`; Yandex UI verified 11 goals and `ecommerce:"dataLayer"`.
  - Risks: Ecommerce is only emitted after a confirmed credited top-up and remains consent-gated; live production tag verification requires the rollout image.

- [ ] **[FEATURE][ANALYTICS][PRIVACY]** Add consent-safe Yandex Metrica and Google Analytics coverage to Airis landing and product
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__privacy-safe-web-analytics.md`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Summary: Configure Yandex counter 111392024 for chat.airis.you and add a shared, privacy-safe event layer for the landing-to-first-answer funnel.
  - Tests: `npm run test:frontend -- --run src/lib/utils/airis/analyticsConsent.test.ts src/lib/utils/analytics.test.ts` (4 tests passed); `npm run check`; `npm run build:vite`; targeted ESLint; `git diff --check`
  - Risks: Third-party scripts are gated by public configuration and consent; app remains a no-op when providers are absent.

- [ ] **[FEATURE][BILLING][UX]** Make top-up recovery obvious when a paid model reaches zero balance
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__feature__billing-topup-recovery-clarity.md`
  - SDD Spec: `meta/sdd/specs/active/billing-topup-recovery-clarity-2026-08-07-001.json`
  - Owner: Codex
  - Branch: `codex/feature/billing-balance-history-simplify`
  - Started: 2026-08-07
  - Summary: Show the exact shortfall in the chat block, make the wallet top-up action explicit, and preselect the contextual package while preserving a quiet opt-out.
  - Tests: Pending implementation
  - Risks: Payment-entry copy and CTA prominence change; no payment or billing rules are changed.

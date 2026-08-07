### Done

- [x] **[UX/IA]** Simplify public Airis pages for ordinary users
  - Spec: `meta/memory_bank/specs/work_items/2026-08-07__refactor__public-pages-simple-ux-ia.md`
  - Owner: Codex
  - Branch: `codex/fix-wallet-topup-clarity`
  - Started: 2026-08-07
  - Done: 2026-08-07
  - Summary: Rework non-home public pages around task-first IA, truthful product states, and one clear path into Airis. Fixed the async pricing estimator rate-card dependency, guarded unavailable capabilities/limits, unified “О продукте” naming, added CTA source attribution, aligned pricing/docs theme surfaces, removed unsupported marketing-cookie wording, and deduplicated app metadata on marketing routes.
  - Tests: `git diff --check`; focused Vitest 8/8; Vite production build; changed-file ESLint; production route/API/link smoke; local 390px responsive audit. `npm run check` still reports pre-existing baseline errors outside landing scope.
  - Risks: Legal copy semantics were preserved; image/TTS UI remains hidden until the public rate-card exposes those capabilities.

### Final audit update (2026-08-07)

- Fixed public-layout horizontal overflow on narrow viewports caused by decorative document-page layers (`PublicPageLayout.svelte`).
- Fixed analytics build-time configuration and verified Yandex Metrica loads only after consent with counter `111392024`.
- Enabled indexing for public routes only, added canonical/Open Graph metadata, and published a public sitemap; private application routes remain `noindex,nofollow`.
- Verified local production build with Playwright: all public routes return 200, local links resolve, buttons are labelled, and 390px pages have no overflow. Production API/routing smoke passed; the deployed artifact still needs the current branch rollout for the overflow fix.

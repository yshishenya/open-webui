# Welcome landing Airis brand refinement

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/feature/landing-airis-refinement`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/welcome-airis-landing-2026-08-06-001.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The product-first `/welcome` iteration is clearer than the previous landing, but its white lower-page canvas loses the established Airis brand atmosphere and makes the page feel generic. The content also under-explains the multi-model value while several reference-page claims (automatic model selection, video generation, training-data guarantees) are not confirmed by the product and must not be copied.

This iteration combines the airy editorial composition of visual option 2 with the useful, lightweight interactions from option 3. It targets Russian-speaking consumers who want practical AI help without VPN, foreign cards, multiple services, or complex setup.

## Goal / Acceptance Criteria

- [x] The primary message is understandable within the hero: AI models in one chat, directly available without VPN.
- [x] The page uses a continuous Airis indigo/violet visual system with no abrupt generic white-page transition.
- [x] Each major section communicates one question, one answer, and one dominant visual; the page has more vertical breathing room without empty filler.
- [x] Claims are grounded in current product behavior and public APIs; unsupported automatic routing, video, privacy, statistics, or testimonial claims are absent.
- [x] Available model counts and free-start availability are sourced dynamically when the public APIs respond and degrade quietly when unavailable.
- [x] Product UI shown on the landing is a current, privacy-safe capture of the real Airis interface and is identified as such.
- [x] Hero demo, scenario tabs, CTA/preset navigation, pricing disclosure, and FAQ are keyboard operable and responsive.
- [x] No horizontal overflow, clipped copy, inaccessible focus states, relevant console errors, or framework overlays remain in the landing implementation.
- [x] Frontend tests, targeted Svelte checks/lint, production build, and in-app Browser desktop QA pass.

## Non-goals

- Redesigning `/features`, `/pricing`, or the authenticated chat UI.
- Adding new product modalities, provider integrations, testimonials, metrics, or dependencies.
- Promising automatic model selection or literally every AI model in existence.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - Refine the Airis-owned `/welcome` landing composition, copy, responsive behavior, and interactions.
  - Reuse existing billing public APIs, preset navigation, analytics, icons, and footer components.
  - Replace the illustrative model-picker mock with a current capture of the real product UI.
  - Adjust the welcome-only navigation anchor and route background when needed.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/welcome/+page.svelte`
  - `src/lib/components/landing/WelcomeProductLanding.svelte`
  - `src/lib/components/landing/NavHeader.svelte`
  - `src/lib/components/landing/welcomeNavigation.test.ts`
  - `static/landing/airis-product-models.jpg`
- API changes:
  - None; reuse `getPublicLeadMagnetConfig()` and `getPublicRateCards()`.
- Edge cases:
  - Hide dynamic model proof gracefully if rate cards are unavailable.
  - Do not expose modality quotas while the public capability catalog and lead-magnet configuration disagree.
  - Preserve natural section height on small screens instead of enforcing viewport-height panels.
  - Respect `prefers-reduced-motion`.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/welcome/+page.svelte` (thin route-level data/background hook only).
- Why unavoidable:
  - The route owns public-data loading and the page root background.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the visual and interaction implementation in the existing Airis-owned landing component and reuse established APIs/navigation helpers.

## Verification

- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend"`
- Frontend typecheck/lint: `npm run check` and `npm run lint:frontend` in the configured frontend container or local workspace when dependencies are already installed.
- Build: `npm run build` with the repository-supported Node heap when needed.
- Browser QA: production-like local `/welcome`, desktop and mobile, interactive tabs/presets/FAQ/CTA, console health, screenshot comparison against the selected concept and `airis.you`.

## Task Entry (for branch_updates/current_tasks)

- [x] **[UI]** Refine `/welcome` around the Airis brand and verified multi-model USP
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__welcome-airis-brand-refinement.md`
  - Owner: Codex
  - Branch: `codex/feature/landing-airis-refinement`
  - Started: 2026-08-06
  - Summary: Replace the white lower-page canvas with an airy Airis violet story, strengthen the without-VPN and multi-model positioning, and preserve product-first interactions without unsupported claims.
  - Tests: 96 frontend tests passed; targeted ESLint/Svelte checks passed; production build passed; Browser interaction and visual QA passed.
  - Risks: Public model/quota APIs can be unavailable; content must degrade without broken or misleading states.

## Risks / Rollback

- Risks:
  - More dark surfaces can reduce readability if contrast and spacing are not verified.
  - Additional public data could cause visible error states or layout shifts.
  - Long landing content can become repetitive on mobile.
- Rollback plan:
  - Revert the landing refinement commit; no backend, schema, or config rollback is required.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete welcome-airis-landing-2026-08-06-001 --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec welcome-airis-landing-2026-08-06-001 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

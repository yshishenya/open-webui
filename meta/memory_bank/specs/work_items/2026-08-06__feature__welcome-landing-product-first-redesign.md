# Welcome Landing Product-first Redesign

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: `codex/feature/welcome-landing-redesign`
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/welcome-landing-product-first-2026-08-06-001.json`
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The current `/welcome` page contains useful product, use-case, free-quota, and pricing information, but presents too many equally prominent cards, repeated trust messages, and a desktop layout that overflows on a 390px viewport. The separate brand site at `airis.you` has a recognizable deep-violet visual language and emotional clarity, but its live implementation has low-contrast copy, excessive whitespace, layout clipping, and weak product proof.

The selected direction combines the strongest parts of both: the Airis violet brand and calm visual character, plus the built-in landing's real product flows, presets, live lead-magnet quotas, and PAYG explanation. It follows a product-first narrative and progressive disclosure so the page remains concise and scannable.

Reference plans:

- `meta/memory_bank/specs/landing_conversion_plan.md`
- `meta/memory_bank/specs/public_pages_2026_plan.md`
- `meta/memory_bank/specs/payg_lead_magnet_policy.md`

## Goal / Acceptance Criteria

- [x] Present one clear conversion story: promise → product proof → familiar tasks → three-step usage → trust → PAYG pricing → FAQ → CTA.
- [x] Use the `airis.you` brand palette and typography direction while meeting readable contrast and responsive-layout requirements.
- [x] Make the hero product demo and use-case explorer interactive, keyboard accessible, and wired to existing preset/signup navigation.
- [x] Reuse live public lead-magnet quotas and existing CTA/preset helpers; do not introduce fake metrics, testimonials, or hard-coded model availability.
- [x] Keep one consistent primary CTA and remove repeated chips, dense card grids, redundant sections, and the mobile sticky CTA.
- [x] Avoid horizontal overflow at 320px, 390px, 768px, 1024px, and 1440px widths.
- [x] Preserve authenticated redirect, Telegram auth callback, analytics events, SEO metadata, pricing links, and legal/footer navigation.
- [x] Add no dependencies and make no backend, environment, schema, or migration changes.
- [x] Verify targeted frontend tests, Svelte typecheck, ESLint, accessibility basics, and desktop/mobile visual fidelity.

## Non-goals

- Redesigning `/features`, `/pricing`, `/about`, `/contact`, authentication, or the chat application.
- Adding new pricing APIs, analytics infrastructure, testimonials, user counts, model logos, or an autoplay product video.
- Reproducing `airis.you` weaknesses such as low-contrast body text, giant decorative gaps, unrelated media, or fragile scroll effects.

## Scope (what changes)

- Backend:
  - No changes.
- Frontend:
  - Refactor the Airis-owned `/welcome` route into the selected product-first IA.
  - Add an Airis-owned landing component for the interactive demo, use-case explorer, steps, trust, pricing, FAQ, CTA, and footer.
  - Add a welcome-specific violet variant to the existing public navigation without changing other public-page styling.
  - Reuse `welcomeNavigation.ts`, preset data, and public lead-magnet configuration.
- Config/Env:
  - No changes.
- Data model / migrations:
  - No changes.

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/welcome/+page.svelte`
  - `src/lib/components/landing/WelcomeProductLanding.svelte`
  - `src/lib/components/landing/NavHeader.svelte`
  - `src/lib/components/landing/index.ts`
- API changes:
  - None. Continue using `getPublicLeadMagnetConfig()`.
- Design tokens:
  - Brand background `#1E1647`, raised surface `#2C2359`, accent `#7132F2`, lavender `#AD93FC`, white/off-white content surfaces.
- Interaction model:
  - Demo tabs and audience tabs use native buttons with an ARIA tab pattern.
  - Scenario tasks expose recognizable prompts and start the existing preset/signup flow.
  - FAQ uses native `details/summary` disclosure and deep-links the pricing explanation.
- Edge cases:
  - Lead-magnet configuration unavailable or disabled.
  - Missing preset data.
  - Authenticated users and `redirect` query handling.
  - Reduced-motion preference and keyboard-only navigation.
  - Long Russian copy at narrow widths.

## Research Basis

- Nielsen Norman Group: progressive disclosure should surface the few frequent choices and defer secondary detail; recognition is easier than recall, so visible task examples help first-time users; web content should be concise and scannable.
- W3C WCAG 2.2: readable contrast, visible unobscured focus, semantic controls, and minimum pointer target sizing.
- web.dev Core Web Vitals: avoid heavyweight hero media and layout shifts; keep the hero asset dimensions explicit and interactions responsive.
- Current product references: Claude prioritizes a short promise and immediate trial; Linear proves the product through realistic interface sequences; Notion AI pairs a concrete promise with use cases, trust, pricing, and FAQ. Airis should adopt the clarity, not their page length or enterprise density.

## Upstream impact

- Upstream-owned files touched:
  - None. `/welcome` and landing components are Airis-specific fork-owned surfaces.
- Why unavoidable:
  - N/A.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep the redesign additive in `src/lib/components/landing/WelcomeProductLanding.svelte`; leave legacy public components available for other routes and limit the route diff to wiring.

## Verification

- `npm run test:frontend -- --run`: 22 files and 93 tests passed.
- Targeted landing navigation Vitest: 6 tests passed.
- Targeted ESLint for all touched frontend files: passed.
- Targeted `svelte-check` for `/welcome`: 0 errors and 0 warnings; landing component workspace: 0 errors with one pre-existing unrelated warning in `FeatureCard.svelte`.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build:vite`: passed. The default 4 GB Node heap reached its limit during whole-project chunk rendering; the retry completed with the existing repository warnings outside this change.
- Browser QA: demo tabs, scenario tabs, FAQ disclosure, keyboard focus, and CTA/preset flows passed.
- Responsive QA: desktop `scrollWidth` matched viewport width; a 390px mobile viewport rendered at 383px content width with `scrollWidth: 383px` and no horizontal overflow.
- Visual comparison completed against:
  - `airis.you` captured desktop/mobile references.
  - Approved desktop mock `exec-efb6f5b2-9f6b-45f4-b699-c71906685707.png`.
  - Approved mobile mock `exec-00caddff-2019-461e-9877-a8ea445a9e80.png`.

## Task Entry (for branch_updates/current_tasks)

- [x] **[UI][LANDING][UX]** Redesign `/welcome` as a concise product-first landing
  - Spec: `meta/memory_bank/specs/work_items/2026-08-06__feature__welcome-landing-product-first-redesign.md`
  - Owner: Codex
  - Branch: `codex/feature/welcome-landing-redesign`
  - Started: 2026-08-06
  - Summary: Combine the Airis brand language with the current built-in landing's real product, preset, quota, and PAYG flows in a responsive, interactive, lower-density page.
  - Tests: Frontend 93/93; targeted landing navigation 6/6; ESLint and Svelte checks passed; production build passed with an 8 GB Node heap; desktop/mobile browser QA passed.
  - Risks: Medium (public acquisition and signup conversion path).

## Risks / Rollback

- Risks:
  - Reduced copy could omit a high-value use case; preserve a representative breadth strip and link to `/features`.
  - Interactive demo could feel fake; use real preset copy and route every task action into the existing product flow.
  - Public-page CSS could leak; scope all new styles under the component root and gate header styling by `currentPath`.
- Rollback plan:
  - Revert the route wiring and welcome-specific header branch; legacy landing components remain intact.

## Completion Checklist

- [x] `meta/tools/sdd check-complete welcome-landing-product-first-2026-08-06-001 --json`
- [x] `meta/tools/sdd complete-spec welcome-landing-product-first-2026-08-06-001 --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`).

# Keep welcome navigation in the current landing experience

## Meta

- Type: bug fix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/welcome-navigation-routes`
- SDD Spec: N/A (localized navigation-only fix)
- Created: 2026-08-06
- Updated: 2026-08-06

## Context

The redesigned `/welcome` page still linked to the legacy `/pricing`, `/features`, `/about`, and `/contact` marketing pages. Users left the current Airis experience and saw the previous white visual system, most visibly after clicking “Посмотреть тарифы”.

## Goal / Acceptance Criteria

- [x] Marketing links from `/welcome` stay on relevant sections of the current landing.
- [x] Support opens the real support email instead of the legacy contact page.
- [x] Legal links continue to open the canonical document routes.
- [x] Login, signup, anchors, and real product examples still work.
- [x] A focused regression test prevents legacy marketing routes from returning.

## Scope

- `src/lib/components/landing/WelcomeProductLanding.svelte`
- `src/lib/components/landing/welcomeLandingLinks.test.ts`

## Root Cause

The welcome component reused default footer routes and two in-section links from the previous public landing architecture instead of supplying navigation for the new self-contained page.

## Upstream impact

- The change is isolated to the Airis welcome component and an additive regression test.
- Shared public-page navigation remains unchanged for the legacy routes themselves.

## Verification

- Focused Vitest: 7/7 welcome navigation and landing-link tests passed.
- Targeted ESLint and Prettier checks passed.
- Production Vite build passed with an 8 GB heap; the default 4 GB heap was insufficient for the existing 6,516-module bundle.
- In-app Browser smoke passed for anchors, support/legal links, signup/login, and real product examples.
- Full frontend suite: 97/98 passed; the unrelated existing `admin_navigation_regressions.test.ts` expects removed admin billing sublinks and remains outside this diff.

## Risks / Rollback

- Risk: exact model rates remain intentionally outside the short landing; the pricing block explains the billing model and the account shows actual expenses.
- Rollback: revert this work item to restore legacy page links.

## Completion Checklist

- [x] Verification completed.
- [x] Branch update moved to Done.

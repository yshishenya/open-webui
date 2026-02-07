# Auth: Login Screen Redesign (Airis)

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/auth-login-redesign
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-07
- Updated: 2026-02-07

## Context

The current `/auth` UI works functionally, but feels visually flat and inconsistent:

- Inputs are borderless/transparent which hurts scannability and makes focus states easy to miss.
- The page lacks a clear "card" container, so content can look stretched (especially on wide screens).
- OAuth buttons mix several visual styles (neutral pills + fully filled brand buttons), creating a noisy hierarchy.

Additionally, the desired reference direction is a **modal-like**, mobile-friendly auth sheet: big headline, pill buttons,
provider-first entry, and a clear “Email vs Social” split without SMS.

## Goal / Acceptance Criteria

- [ ] `/auth` feels like a modal sheet: dark OLED backdrop, close `X`, and a centered rounded card.
- [ ] Entry screen is provider-first: Yandex / VK / GitHub shown as consistent pill buttons (no SMS option).
- [ ] Email flow is a separate panel with clear “sign in vs sign up” states and visible focus rings.
- [ ] Inputs have explicit surfaces + visible keyboard focus (WCAG-friendly).
- [ ] Provider buttons have consistent structure (brand badge, label, loading state) while preserving brand recognition.
- [ ] Layout is responsive and looks correct at 320px / 768px / 1024px+.
- [ ] Minimal upstream diff: changes are localized to the auth page and/or Airis-owned helpers/styles.

## Non-goals

- Password reset flow (not currently implemented).
- Changing auth backend behavior or OAuth configuration.

## Scope (what changes)

- Backend:
  - None
- Frontend:
  - Update `/auth` layout and styling (container, background, form controls, buttons).
  - Keep existing logic (modes: signin/signup/ldap, legal acceptance gate, OAuth providers).
- Config/Env:
  - None
- Data model / migrations:
  - None

## Implementation Notes

- Key files/entrypoints:
  - `src/routes/auth/+page.svelte`
- UI structure:
  - Panel `choice`: social providers + email entry.
  - Panel `email`: existing modes (signin/signup/ldap) using the same handlers as before.
- Edge cases:
  - Signup: legal checkbox disables submit until accepted.
  - VK: support VK ID SDK widget (when configured) and legacy redirect flow fallback.
  - Signup disabled: “email” button opens signin (no signup toggle).
  - No social providers: default to email panel.

## Upstream impact

- Upstream-owned files touched:
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/common/SensitiveInput.svelte`
- Why unavoidable:
  - Auth page markup currently owns layout and classnames; no stable extension point for a page-level redesign.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Keep changes class-level and layout wrappers only; no logic rewrites.
  - Any visuals are kept page-local (Tailwind classes on `/auth`), no global CSS changes.

## Verification

- Lint (targeted, docker): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npx eslint src/routes/auth/+page.svelte"`
- Note: full repo frontend lint/typecheck currently emits a large amount of legacy errors (noise) and is tracked separately; not addressed in this work item.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[UI][AUTH]** Auth page redesign (login screen)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__feature__auth-login-redesign.md`
  - Owner: Codex
  - Branch: `codex/feature/auth-login-redesign`
  - Started: 2026-02-07
  - Summary: Redesign `/auth` as a modal-like OLED sheet with provider-first entry and a separate email panel (no SMS).
  - Tests: Pending
  - Risks: Low-Medium (touches auth UX; watch for layout regressions in all modes/providers).

## Risks / Rollback

- Risks:
  - Visual regressions on small screens or in LDAP/onboarding modes.
  - Brand button styling regressions (VK/Yandex) if selectors are too aggressive.
- Rollback plan:
  - Revert styling/layout changes in `src/routes/auth/+page.svelte` (no backend impact).

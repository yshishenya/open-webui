# Branch updates: codex/feature/auth-login-redesign

- [ ] **[UI][AUTH]** Auth page redesign (login screen)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__feature__auth-login-redesign.md`
  - Owner: Codex
  - Branch: `codex/feature/auth-login-redesign`
  - Started: 2026-02-07
  - Summary: Redesign `/auth` as a modal-like OLED sheet with provider-first entry and a separate email panel (no SMS); add safe close + Telegram fallback when configured.
  - Update: 2026-02-07
  - Update Summary: Fix i18n key usage (no Cyrillic keys; add missing legal keys), disable close during Telegram auth, and replace non-standard Tailwind opacity classes with valid ones. Follow-up: harden close navigation against OAuth hops, remove i18n string concatenations, and make SensitiveInput update value on input.
  - Update: 2026-02-08
  - Update Summary: Stabilize initial panel selection when backend config is late-loaded (keep provider-first default; still default to email panel when no social providers). Tidy closeAuth implementation and guard against navigating to /auth itself. Avoid redirecting away from /auth when `$user` is `null` (logged out) and return early when already authenticated.
  - Tests: Not run (no existing auth UI tests); lint (targeted, docker): `npx eslint src/routes/auth/+page.svelte`
  - Risks: Low-Medium (touches auth UX; watch for layout regressions in all modes/providers).

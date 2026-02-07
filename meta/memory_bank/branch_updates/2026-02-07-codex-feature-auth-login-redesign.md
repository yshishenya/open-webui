# Branch updates: codex/feature/auth-login-redesign

- [ ] **[UI][AUTH]** Auth page redesign (login screen)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-07__feature__auth-login-redesign.md`
  - Owner: Codex
  - Branch: `codex/feature/auth-login-redesign`
  - Started: 2026-02-07
  - Summary: Redesign `/auth` as a modal-like OLED sheet with provider-first entry and a separate email panel (no SMS); add safe close + Telegram fallback when configured.
  - Update: 2026-02-07
  - Update Summary: Fix i18n key usage (no Cyrillic keys; add missing legal keys), disable close during Telegram auth, and replace non-standard Tailwind opacity classes with valid ones.
  - Tests: Not run (no existing auth UI tests); lint (targeted, docker): `npx eslint src/routes/auth/+page.svelte`
  - Risks: Low-Medium (touches auth UX; watch for layout regressions in all modes/providers).

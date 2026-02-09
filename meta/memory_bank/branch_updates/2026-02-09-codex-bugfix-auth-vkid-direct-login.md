# Branch Updates: codex/bugfix/auth-vkid-direct-login

- [ ] **[BUG][AUTH]** VKID direct login + Telegram hitbox + official Yandex/VK icons on `/auth`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-09__bugfix__auth-vkid-direct-login-telegram-hitbox-yandex-icons.md`
  - Owner: Codex
  - Branch: `codex/bugfix/auth-vkid-direct-login`
  - Started: 2026-02-09
  - Summary: Fix Telegram icon click area, make VK/OK/Mail one-click via VKID.Auth.login, and swap in official icons.
  - Tests: Pending
  - Risks: Low-Medium (auth UX flow touches; needs smoke test on mobile + VKID popup behavior).

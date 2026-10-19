- [ ] **[BUG][AUTH]** Восстановить вход VK ID при неполном профиле
  - Spec: `meta/memory_bank/specs/work_items/2026-10-19__bugfix__vk-login-recovery.md`
  - Owner: Codex
  - Started: 2026-10-19
  - Summary: Разделить подтверждённую личность VK, необязательный профиль и адрес новой регистрации; сохранить запрет доверия браузерным claims и автоматического слияния.

- 2026-10-19: reproduced old rejection, resolved provider binding before requiring signup email, tolerated nullable optional profile fields, preserved browser distrust/collision/disabled-Auth gates. 21 focused and 1287 backend checks passed (10 skipped); focused Black/Ruff passed. Clean build and production acceptance in progress.

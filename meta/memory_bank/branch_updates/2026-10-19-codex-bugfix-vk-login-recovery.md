- [x] **[BUG][AUTH]** Восстановить вход VK ID при неполном профиле
  - Spec: `meta/memory_bank/specs/work_items/2026-10-19__bugfix__vk-login-recovery.md`
  - Owner: Codex
  - Started: 2026-10-19
  - Done: 2026-10-19
  - Summary: Разделить подтверждённую личность VK, необязательный профиль и адрес новой регистрации; сохранить запрет доверия браузерным claims и автоматического слияния.

- 2026-10-19: reproduced old rejection, resolved provider binding before requiring signup email, tolerated nullable optional profile fields, preserved browser distrust/collision/disabled-Auth gates. 21 focused and 1287 backend checks passed (10 skipped); focused Black/Ruff passed. Clean build and production acceptance in progress.

- 2026-10-19: code PR #370 merged; source `a4d2ff5ebc16688475a207757ad39e294c45b242` installed and pinned as `vk-login-a4d2ff5ebc-20261019`, digest `sha256:6d09783110a4d6d36359f9cc209e17a1f1156aab7d1e148d1a19b596608e4fde`. 1287 candidate backend, 205 PostgreSQL and 2604 frontend tests passed; exact-source CI green. Guarded backup/migration/service-only rollout, health/file/environment/money/mount/14-neighbor/native/model checks passed. Temporary inputs removed; verified private backups retained. SDD closed. Real user VK retry remains external acceptance.

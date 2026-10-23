- [ ] **[BUG]** Обновить доверенные сертификаты и Node AIRIS
  - Spec: `meta/memory_bank/specs/work_items/2026-10-23__bugfix__emudhra-security.md`
  - Owner: security-20261023
  - Started: 2026-10-23
  - Summary: Подготовлен отдельный worktree из c38616a0b. Production certifi2026.7.22 и системный CA20250419~deb12u2 требуют проверки/обновления; production не менялся.
  - Tests: inventory/health metadata; исходные и runtime проверки впереди.
  - Risks: guarded release и применимое backup-разрешение обязательны.

  - Validation: backend1394 passed/13 skipped; frontend2783 passed across252 files; svelte-check0 errors/0 warnings; ESLint PASS; Vite production build PASS with8GiB heap in isolated12GiB container. First test runner lacked bash (10 failures, environment corrected), first build4GiB heap failed OOM (retained); no thresholds reduced. Native production image/package/model acceptance and deployment remain pending.
  - Production gates: AIRIS disk9GiB below required10GiB; no cleanup permission yet. Fresh predeploy backup authority is pending user response. Existing current sourcec386 includes reviewed but not running PR385 billing work; preloaded cc0d image is preserved.

- [ ] **[BUG][ANALYTICS]** Аудит и восстановление подключения Яндекс Метрики
  - Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
  - Owner: Codex
  - Branch: codex/bugfix/metrica-audit-20260930
  - Started: 2026-09-30
  - Summary: Аудит завершён, подготовлены CI build args и исправления SPA/privacy/UTM. Live восстановление требует настроек Tilda/Метрики, подтверждённого ID, пересборки и публикации; SDD остаётся active.
  - Tests: Read-only HTTPS/Docker; 7/7 scoped Vitest, ESLint, source Prettier и diff-check passed; CI YAML parsed. Full typecheck failed (8363 errors / 226 warnings вне изменённых analytics файлов), YAML formatting также failing на исходном HEAD.
  - Risks: Provider settings/report delivery и deploy не проверены; данные до восстановления тега невозможно получить из frontend задним числом.

## 2026-09-30 — локальная сборка обязательна; live task pending

- Spec: `meta/memory_bank/specs/work_items/2026-09-30__bugfix__yandex-metrica-production-audit.md`
- Исправления pushed: a5ccb3c87; 8/8 focused tests, scoped ESLint passed.
- Browser baseline: Tilda и product не загружают Метрику; Chatra script Tilda сломан.
- Серверные frontend build попытки завершились OOM (134/137), rollout не выполнен.
  После указания пользователя собирать на Mac серверные сборки не запускались,
  temporary swap удалён. Production image прежний, healthy и /health=true.
- Локальный проект найден; local command executor этого чата недоступен.
  Готовы команды в `meta/docs/releases/metrica-local-build.md`.
- Tilda, кабинет Метрики, GitHub API и реальный local build требуют доступа.
  Release notes — черновик; live task и SDD остаются незавершёнными.

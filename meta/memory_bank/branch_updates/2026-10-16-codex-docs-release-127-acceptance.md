# Branch update — release127 acceptance

- [x] **[OPS][RELEASE]** Record verified production release127 and remaining pilot gates
  - Spec: meta/memory_bank/specs/work_items/2026-10-15**ops**release-candidate.md
  - Owner: Codex
  - Branch: codex/docs/release-127-acceptance
  - Done: 2026-10-16
  - Summary: Accepted source76031ee6dd360459f23a6562f1a58bc95173f105, reproducible image, exact-source CI, guarded rollout, live3 free responses/quota and diagnostic Inbox/Reply-To. Source/runtime unchanged by this documentation update.
  - Tests: Recorded Compose frontend2604/backend1297 by exact parity; browser147/86mandatory/4explicit external skips; production/native/files/money/backup checks. SDD/documentation validation run for this update.
  - Risks: Full Ruff474 existing diagnostics, real pilot0ready, physical phone/usefulness/new payment/external delivery and real calendar windows remain open; no artificial consent or pilot records.

- [x] **[OPS]** Technical mail and chat acceptance
  - Spec: meta/memory_bank/specs/work_items/2026-10-16__ops__technical-mail-smoke.md
  - Owner: Codex
  - Done: 2026-10-16
  - Summary: 6/6 diagnostic template emails delivered once into support Inbox; Mail.app reply received; one real free response with exact 4616/78 usage and 0 ₽; 197 mail tests passed, zero failures/errors/skips. Product email flags remain off; production preserved.
  - Evidence: /Users/yshishenya/.codex/private-artifacts/airis-technical-mail-smoke-20261016/RESULT.md

- [x] Проверка нового обычного аккаунта и внешней доставки AIRIS
  - Spec: meta/memory_bank/specs/work_items/2026-10-16__ops__new-account-acceptance.md
  - Owner: Codex
  - Done: 2026-10-16
  - Summary: регистрация/подтверждение, три бесплатных ответа и точный учёт, одно настоящее welcome в Яндекс Почте, Reply-To и отписка проверены. После проверки согласие восстановлено через настройки, тестовая группа закрыта, постоянная очередь выключена. Переходы темы/плана работают после обновления старой вкладки.

- [ ] **[OPS]** Штатное расписание A на одном аккаунте владельца
  - Spec: `meta/memory_bank/specs/work_items/2026-10-16__ops__scheduled-owner-observation.md`
  - Owner: Codex
  - Started: 2026-10-16
  - Summary: Ограниченный A запущен на одном аккаунте владельца, первый штатный обход через 63 с; дублей/новых попыток/изменения денег 0. Серверная копия проверена, образ и остальная среда сохранены. Частные планы обновлены до 202/244; реальные окна и независимый пилот остаются открытыми, ежедневная проверка создана.

- [x] **[DOCS][OPS]** Сверка оставшихся условий и инструкция поддержки
  - Spec: `meta/memory_bank/specs/work_items/2026-10-16__docs__remaining-onboarding-gates.md`
  - Owner: Codex
  - Done: 2026-10-16
  - Summary: Проверены 22 завершённых SDD и конкретное покрытие сохранённых JUnit, неизменность runtime source, рабочий калькулятор/API и независимый расчёт. Подтверждены A.02/A.04/A.07/B.05; частный план 206/244, остальные внешние и календарные критерии открыты. Добавлена инструкция поддержки, без новых служб и обещания срока ответа.

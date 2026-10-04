- [ ] **[BUG][CHAT]** Ждать форму до автоматической отправки query
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__query-variable-submit.md`
  - Owner: Codex
  - Branch: `codex/bugfix/query-variable-submit`
  - Started: 2026-10-04
  - Summary: Helper/URL/desktop query не ждут завершения формы и используют сырой шаблон. Cancel должен прекращать отправку; Save отправляет заполненныйprompt.
  - Tests: Полный собранный кандидат и причинные проверки pending; база437/4225/174/1503.
  - Risks: Общий frontend rollout до исправления NO-GO; production сохраняется.

- 04.10.2026: воспроизведена ранняя отправка в URL и desktop на настоящем образе; минимальная правка setText/helper/Chat. 49 целевых и 443 полных теста, строгий ESLint семи файлов; 0 новых диагностик типов/общего ESLint. Собранный кандидат, exact-source CI и выпуск pending.

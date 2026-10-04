- [x] **[BUG][OPS]** Выпустить принятый общий frontend с сохранением server base
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__ops__shared-frontend-rollout.md`
  - Owner: Codex
  - Branch: `codex/bugfix/shared-frontend-rollout`
  - Done: 2026-10-04
  - Summary: Candidate source89b869201, backend/dependencies идентичны production239275712; проверка/выпуск общего кандидата отдельно.
  - Tests: Source437 frontend/900 backend;11 PostgreSQL; новый production-config build и живые пути pending.
  - Risks: Сохранить полный Compose из3 файлов и публичную конфигурацию аналитики. Общий G14 открыт.

- 04.10.2026: кандидат source4a6a3feee после PR231 принят:4913 frontend/501 backend hashes,19 query/guide +3 shared UI cases. Actual notes persist/reload; map teardown700ms/0errors. Full current Compose changes only image. Production rollout pending.

- 04.10.2026: production accepted source4a/frontend4913 hashes, preserved backend501 live hashes and ENV/13 retained neighbors, hard migration gate, verified backup/rollback, healthy/restarts0. Full Compose default image retained. Live Cancel/Save draft0messages/0errors; formatted shared3/3 pass with strict ESLint/Prettier. SDD3/3 closed; general quality debt and real pilot gates remain open.

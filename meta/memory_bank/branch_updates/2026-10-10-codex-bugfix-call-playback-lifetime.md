- [x] **[BUG][CALL]** Завершение ожиданий озвучивания звонка
  - Spec: meta/memory_bank/specs/work_items/2026-10-10__bugfix__call-playback-lifetime.md
  - Owner: Codex
  - Branch: codex/bugfix/chat-dispatch-replay
  - Done: 2026-10-10
  - Summary: Воспроизведение отказов/отмены playback и запоздавшего синтеза; проверка сохранности существующих lifecycle guards.

  - Tests: Docker1340/142,focused38,new23;12исходныхотказов.Types1504/94,new0,removed57;ESLint893,new0,removed3.Frozen1735/backend542/protected21 сохранены;SDD2/2 завершена.
  - Risks: Общиеgates/новыйвыпуск/внешняяприёмка открыты. Productioncore/12оставшихсясоседей сохранены;удаление временного терминала наблюдалось отдельно,инициатор неизвестен,образсохранён. СтарыйAPIсинтеза не отменяет транспорт.

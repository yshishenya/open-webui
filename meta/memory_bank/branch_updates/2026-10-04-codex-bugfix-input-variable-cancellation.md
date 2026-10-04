- [x] **[BUG][UI]** Прекратить обработку отменённой формы переменных
  - Spec: `meta/memory_bank/specs/work_items/2026-10-04__bugfix__input-variable-cancellation.md`
  - Owner: Codex
  - Branch: `codex/bugfix/input-variable-cancellation`
  - Done: 2026-10-04
  - Summary: Общая отмена завершает ожидание сnull; чат/канал прекращают продолжение без сохранения/отправки. Поздний обработчик уничтожения и отказ Save сохраняют возможность отмены.
  - Tests:31 новых проверок;437/437 полный Vitest;28 браузерных сценариев/0 pageerror;0 новых типов/ESLint.
  - Risks: Отмену нельзя считать обычным текстом: onSelect может отправить запрос.

    04.10.2026 — исправление и локальные проверки приняты, SDD2/3. Exact-source CI/merge pending; рабочий сервер этой правки ещё не принят.

  04.10.2026 — PR229 source89b869201/merge3d421e035 принят по exact-head CI,10success/1skip,6 source hashes сохраняются. SDD3/3 закрыт. Backend900/5PostgreSQL-only skips; дополнительнаяPostgreSQL11/0skip закрыла все5 пропусков и lifecycle. Замороженныйfrontend build4096MiB проходит. Production/G14 остаются самостоятельными условиями.

- [ ] **[BUG] Долговечная защита от повторного запуска**
  - Spec: meta/memory_bank/specs/work_items/2026-10-09**bugfix**chat-dispatch-replay.md
  - Owner: Codex
  - Started: 2026-10-09
  - Summary: Реальный повтор HTTP и ошибка регистрации task могут дать второй provider запуск; цель — один durable owner/operation, повтор того же ack и ноль слепых повторов unknown.

  - Update: 2026-10-09 — серверная задача SDD 1/2 выполнена. API/JWT/PostgreSQL и SQLite 25/25, backend 1051/0 skip; два процесса имеют одного владельца. Black 462, Ruff 547/новых 0. Интерфейс не менялся; стабильное восстановление полной операции браузера и полный выпуск остаются открытыми. Работа целиком In Progress.

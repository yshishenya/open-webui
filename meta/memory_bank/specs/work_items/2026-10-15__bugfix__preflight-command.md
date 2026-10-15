# AIRIS — одна команда проверки перед PR

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: N/A — команда из существующих проверок и исправление подготовки четырёх DOM-тестов; нового кода приложения нет.

`npm run preflight` отсутствовал: исходный запуск завершается Missing script: preflight. Добавить команду последовательного запуска test:frontend, check, lint:frontend и build:vite. Все шаги уже существуют; && останавливает проверку на первой ошибке. Backend/Black/Ruff и PostgreSQL проверяются отдельно штатными командами и CI. Команда frontend preflight не заявляет проверку серверной части, миграций, E2E или доставки почты.

- [x] npm run preflight выполняется в изолированном Docker Compose на точной копии исходников: все frontend тесты, типы, ESLint и Vite build.
- [x] Backend не меняется относительно принятого e99320385ffa585041f4d55a49bddd3b53047d1a: 1296/0 ошибок/пропусков, Black478 unchanged, новых Ruff0; полный Ruff474 сохранён отдельно.
- [x] Документация, commit/push, чистота/удалённыйSHA; временная сборка удаляется после использования, отчёты сохраняются.

Upstream impact: package.json — одна дополнительная npm command, без новых зависимостей и изменения существующих команд. build:vite использует имеющуюся статику, как чистый production build с AIRIS_PREPARED_STATIC. Проверка SHA256 подготовленной статики, чистый образ и миграции остаются отдельными обязательными этапами кандидата.

Свежий первый запуск: 232 файла/2600 assertions passed, но четыре unhandled errors; результат не принят. В двух тестах jsdom не предоставляет Element.animate — переиспользована прежняя animation fixture. Excel mock сохраняет настоящие utils через importOriginal; используются настоящие листы и реальный excelToTable, проверяются выбор листа и буквальный вредоносный текст. Playground ждёт native tick после mount перед input, как требуется для завершения bind:this. Правила проверки и app source не меняются.

Принятый запуск: 232 файла/2600 тестов, unhandled errors0, types errors0/warnings0, ESLint exit0, Vite build exit0. Четыре затронутых файла:31/31. Прежний backend принят по совпадению всех файлов; новый полный серверный запуск не заявляется. Выпуск, SMTP и пилот остаются открытыми. Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-preflight-123-20261015.

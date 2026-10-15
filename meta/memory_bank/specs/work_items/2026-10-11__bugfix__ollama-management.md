# Управление моделями Ollama

Status: Done (local acceptance; production gates open)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-ollama-management-2026-10-11-043.json

- [x] Проследить все API consumers/серверные endpoints и воспроизвести неверный create/upload и зависание при отказе потока.
- [x] Использовать native JSON payload вместо неработающего Modelfile вызова; строгая проверка входа/результатов и существующее splitStream/requestModelConnection.
- [x] Сохранить выбор моделей, удаление, pull/cancel и valid creation. Reader locks/loading/прежние поля при отказе проверены.
- [x] Полный frontend/type/lint, новых диагностик0; сохранность и SDD3/3.

Upstream impact: ManageOllama, ModelSelector (только существующие типы), Ollama API методы tags/create и сигнатуры индекса download/upload/delete.
Сервер upload уже создаёт модель и возвращает model_created; URL download
создаёт blob. Старый клиент передаёт строку имени как payload и Modelfile как
urlIdx. JSON параметры провайдера используют прежний create endpoint и
сохраняют template/parameters. Нового парсера Modelfile и нового сервиса нет.
Backend/миграции/зависимости не менять; общий пул pull/cancel не переписывать.
Evidence: /Users/yshishenya/.codex/private-artifacts/airis-ollama-management-20261011.
Production и реальные критерии A/B не считать выполненными по локальным проверкам.


Приёмка 11.10.2026:
- Тот же окончательный33набор: до2pass/31fail, после33/33; с pull/cancel69/69.
- Full frontend2236/2236, failed/pending/todo0. Настоящий splitStream и разбитые сетевые фрагменты проверены.
- Types528/63→489/63; ESLint533→533, новых диагностик0. Актуальные240CI lintцелей0/0; новыйtestfile0/0; Prettier4filespassed.
- ModelSelector compiled JS/CSS идентичны, только erasedtypes; Manage markup отличается лишь labelJSON,styles прежние. ОстальныеAPI runtimeметоды идентичны.
- Backend1064/25warnings reused по565совпадающим хешам; нового backend-прогона нет.
- Production revision c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy/restarts0;12соседей,21чужойфайл и262тома сохранены; свои тестовые контейнеры0.
- Промежуточный helperошибочно получил map index как AST; исправлен. Общая предварительная проверка выявила nullable аргумент отмены; минимальный guard добавлен. Окончательные исходники заново полностью проверены. Непринятые журналы сохранены.
- Контролируемые реальные handlers/streams проверены в development harness; production UI с настоящим Ollama этим не доказан.
- Fileupload + emptyJSON доверяет существующему model_created backend. При customsettings отдельный create применяет их к тому же имени на исходном подключении; это не автоматическийretry. Серверная проверка terminal create response вне frontend блока.

Остаётся:
- [ ] Общие quality gates:check489errors/63warnings, ESLint533errors.
- [ ] PR/CI/интеграция/чистыйобраз/выпуск и production приёмка.
- [ ] Реальные A/B: письма/дваоператора/телефон/пилот/платёж/24h/72h/14d.
Основной план198/244,46открытых; номерных закрытий0, финальная цельactive.

# Подсказки: импорт, редактирование и сохранение

Status: Done (local source acceptance; release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-prompt-suggestions-2026-10-10-041.json

- [x] Проследить PromptSuggestions, ModelEditor, ModelDefaultsPanel и POST /configs/suggestions; воспроизвести ошибку импорта/отказ сохранения.
- [x] Переиспользовать SuggestionPrompt и requestJSON. Native input/Action, без нового сервиса/зависимости.
- [x] Неверный импорт сохраняет прежние строки; старые строковые title, массивы и extra поля сохраняют совместимость. Ошибка чтения сообщает безопасный отказ.
- [x] Сохранить редактирование/добавление/удаление/экспорт и единственную серверную отправку; проверить настоящим DOM.
- [x] Полные frontend/type/lint, новых диагностик0, источник/сервер/чужие данные; SDD/commit/push/частные планы.

Upstream impact: только PromptSuggestions и setDefaultPromptSuggestions в configs API.
Существующий server response_model требует массив title:string[],content:string;
текущий клиент ошибочно объявляет вход строкой и может скрыть ошибку какnull.
Импорт проверяет только JSON syntax; content неверного типа доходит до списка.
Evidence: /Users/yshishenya/.codex/private-artifacts/airis-prompt-suggestions-20261010.
Новый выпуск и реальные критерии A/B отдельно; номерные пункты за локальные
проверки не закрывать.

Одинаковые19новых тестов: до4passed/15failed, после19/19;
с существующим сохранением настроек35/35. Настоящий DOM проверяет
атомарный отказ, legacy title, extra поля, редактирование/Blob export,
add/remove, отказ чтения и отсутствие уведомления после уничтожения.
Только один POST/auth/array body; invalid/network/HTTP/JSON ответ отвергается.
Один локальный lifetime flag, один normalizer; Action/SuggestionPrompt/
requestJSON переиспользованы. Стили и остальные API методы не менялись.

Полный frontend2176/2176,failed/pending/todo0;
236CI lintцелей0/0. Types576/64→557/63,ESLint540→538,new0.
Backend1064 reused по565хешам; новая серверная проверка не запускалась.
Заморожены6894файла. Production2026-10-10T18:25:41.750466+00:00 c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908
healthy/restarts0; ENV/config/mounts/12соседей/21чужойфайл/262тома сохранены.
Новый образ/deploy/внешние операции/реальные критерии A/B не выполнялись.
Полные check/lint возвращают1 из-за прежнего общего долга.
План198/244,46открытых; новых номерных закрытий0, цельactive.

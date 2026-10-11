# AIRIS — конфигурация и данные записи голоса

- Workflow: bug_fix (исходный анализ типов выявил реальные ошибки)
- Status: completed (исходники; выпуск pending)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-voice-recording-inputs-2026-10-11-081.json

## Критерии

- [x] Единственный caller MessageInput и путь native capture/recognition → stop → onConfirm/transcribeAudio прослежены. Доступ к микрофону/экрану, MIME выбор, настройки, длительность, отмена и очистка сохраняются.
- [x] Сохранить15 существующих регрессий; воспроизвести неполную конфигурацию, отсутствие браузерного распознавания, раннее уничтожение компонента и вывод текста в консоль.
- [x] Явные локальные типы для существующего SpeechRecognition; optional конфигурация/observer cleanup. Убрать private payload logs. При отсутствии выбранного web-recognizer показать понятную ошибку и освободить запись, без скрытой отправки на сервер.
- [x] Сохранить успешные server/web сценарии и порядок final data/recognition; реальные микрофон/камера/экран не включаются проверками.
- [x] Targeted/full frontend, типы/lint без новых замечаний; scoped lint/формат и компиляция/CSS проходят.
- [x] Production/21 чужой файл/тома/соседи сохранены; план198/244 и цель active. Commit/push проверяются отдельной квитанцией source-remote-receipt.json.

Upstream impact: VoiceRecording.svelte — типы существующего API и локальные guards/удаление журналов; существующий voice_recording_lifetime.test.ts расширяется. При необходимости одна понятная ошибка добавляется в en-US/ru-RU. Новых библиотек, обёртки устройств, службы, схемы или платного fallback нет. Родитель загружается на клиенте после onMount; нового SSR пути для VoiceRecording не заявляем. Backend/API неизменны.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-voice-recording-inputs-20261011`. Общие проверки/PR/CI/собранный интерфейс/выпуск и настоящие A/B остаются открытыми. Откат revert commit.

Причина: режим перечитывался после получения разрешения и в onStop; backend /audio/transcriptions удерживает и списывает stt_second. Один снимок webRecognition до media permission сохраняет выбор; неизвестные настройки прекращают попытку до запроса устройства. Пустая строка engine остаётся штатным server default. Explicit пользовательский web работает без глобальной конфигурации. До27 проверок15 прошли/12 упали; после27/27. Два случая смены режима во время permission проверяют и последующую остановку. Нового разрешения на устройства/платного запроса в тестах нет.

Принято:27/27 focused,2502/2502 полный frontend, failed/pending/todo0. Types92 →80/24, ESLint191 без изменений; новых0. Scoped lint/формат4 файлов pass; future CI354 цели0 ошибок. Две client/server компиляции/CSS совпали, новых предупреждений0.270 SDD valid;3/3 задачи этой спецификации completed. Backend1064/25 повторно не запускался:565 файлов сверены с принятым набором. Actual-source сценарии заменяют аппаратное включение только в локальной проверке; отдельного compiled-browser теста нет.
Production healthy/restarts0, image/env/config/mounts и12 соседей неизменны;21 чужой файл/262 тома сохранены. Общие check/ESLint пока не проходят, PR/CI и выпуск остаются pending. План198/244, новых номерных закрытий0; цель active. История source/remote после commit — в source-remote-receipt.json.

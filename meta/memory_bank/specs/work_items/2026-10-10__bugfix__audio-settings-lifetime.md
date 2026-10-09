# AIRIS — договоры API и время жизни настроек звука

## Meta

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-audio-settings-lifetime-2026-10-10-005.json
- Created: 2026-10-10

## Context / Goal

Продолжение обязательного общего frontend gate G14. Форма audio API не соответствует backend, отказы без detail возвращают null. Оба окна опрашивают native voices таймером без очистки. Пользовательская форма сохраняет name, тогда как воспроизведение ищет voiceURI. Взаимные вызовы getVoices/loadKokoro и mount могут одновременно загружать модель; поздний ответ меняет уже закрытую или переключённую форму.

## Acceptance Criteria

- [x] Исходные отказы воспроизведены публичным API и настоящими обработчиками обеих форм; журналы сохранены.
- [x] Формы config/update/voices/models соответствуют backend; отсутствующие поля config сохраняют исходные значения; сетевой/HTTP отказ не выдаётся за успех/null. Общий getVoices использует id при отсутствующем строковом name провайдера.
- [x] Общий запрос получает отмену и конечный срок вместе с чтением тела; payload сохраняется, mutation не повторяется. Все три потребителя getVoices обработаны; admin не передаёт несуществующий directConnections.
- [x] Native список читается сразу и обновляется через voiceschanged без interval; слушатель снимается при destroy, пустой список безопасен; выбор voiceURI соответствует озвучиванию. Старый сохранённый name сопоставляется с доступным голосом.
- [x] Поздние server/Kokoro ответы не меняют закрытую или переключённую форму; одновременная загрузка одного dtype не удваивается; отказ освобождает loading. Неиспользуемая локальная модель освобождается.
- [x] Редактирование точности в несохранённой форме не меняет общий settings store. JSON параметры перед сохранением проверены на объект; failure не вызывает save/refresh/ложное подтверждение. Первоначальный отказ чтения блокирует save; скрытые допустимые расширения сохраняются, пустая MIME запись не отправляется.
- [x] Конкретные types/i18n/callback/settings/Kokoro/progress; полный frontend проходит, новых types/ESLint0. Исходники/protected/production сохранены; SDD закрыта, commit/push доказаны.

## Upstream impact / Scope

Минимальные правки src/lib/apis/audio/index.ts, chat/Settings/Audio.svelte, admin/Settings/Audio.svelte и workspace/Models/ModelEditor.svelte. Существующие getErrorMessage/settings/native events и Kokoro1.2.1 переиспользуются; новых зависимостей нет. Обязательная форма audio JSON описана по backend TTSConfigForm/STTConfigForm; частичный read-response учитывает пропуски get_config_values. Серверные контракты, цены, платежи и миграции не меняются. Общий KokoroWorker не перестраивается.

## Verification / Risks

Docker Compose-first: before/after настоящих обработчиков, адресные проверки, полный frontend/types/ESLint со сравнением всех сообщений. Проверки управляемых голосов не подтверждают физический телефон или provider/payment. Сохранение конфигурации может завершиться на сервере до отмены браузером; false не доказывает откат. Общий план198/244 и production-выпуск этим этапом не закрываются.

## Accepted result — 10.10.2026

16 исходных отказов воспроизведены на исходном коде (0passed/16failed); дополнительно до последней правки доказана мутация общей точности в несохранённой форме. Финальные адресные проверки44/44; полный Docker frontend1394/1394 в146файлах, failed/pending/todo0.26 новых проверок в одном файле. Все пять изменённых/новых файлов проходят адресный ESLint.

Полные сообщения types/ESLint сравнены:1504/94→1472/94,32 ошибки устранены, новых0; ESLint893→888,5 устранено, новых0.1739 замороженных исходников совпали; backend542 и21 чужой tracked файл основной копии сохранены. Прежние1063 backend tests переиспользованы по идентичным исходникам; нового backend-прогона нет. Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908, image/environment/config/mounts и все12 соседей совпали между свежими снимками, healthy/restarts0. SDD2/2 завершена. Доказательства в закрытом хранилище airis-audio-settings-20261010.

Общий G14/13.11 остаётся открытым из-за существующего долга types/ESLint/Ruff. Новый образ и production-выпуск не выполнялись; основной план198/244 и финальная цельactive не закрываются этим этапом.

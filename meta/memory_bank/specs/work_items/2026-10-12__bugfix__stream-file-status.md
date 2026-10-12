# AIRIS — поток ответа и готовность загруженного файла

- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12
- SDD Spec: meta/sdd/specs/completed/airis-stream-file-status-2026-10-12-085.json

Общий uploadFile используется в чате, канале, заметках, редакторе модели и базе знаний. Ошибка HTTP/network проверки обработки может вернуть исходный файл как готовый; null body даёт техническое падение. SSE readers не освобождаются при terminal marker/error/раннем завершении потребителя. API выводит содержимое событий в консоль. Уточнить контракт существующего нативного decoder (Response.body chunks:ArrayBuffer), обработать отсутствие статуса без ложного успеха, закрывать readers и убрать private logs. Без автоматического повтора загрузки/ответа.

- [x] Воспроизвести missing/non-OK/network status, reader cleanup и private logs; проверить всех вызывающих.
- [x] Минимально исправить общие API, сохранить wire metadata/usage и multipart/process/stream контракт.
- [x] Пройти focused/full/type/lint/format; сохранить production/данные, закрыть SDD, commit/push и обновить план.

Upstream impact: apis/streaming/index.ts и apis/files/index.ts — общие проверки потока/ошибок; knowledge-types.ts/chat_history.ts — уточнение имеющихся полей FileMeta/legacy response. Новых зависимостей/сервисов/миграций нет. Backend status endpoint допускает длительную обработку; timeout ограничивает ожидание HTTP headers, а не весь живой статусный поток. Готовность, завершение обработки с error и ошибка получения статуса различаются. Production/A/B остаются открытыми. Откат — revert commit.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-stream-file-status-20261012`.

Backend FileMeta допускает null content_type; прежний выбор файла переносит null в FileSelection, а чаты/каналы уже обрабатывают его через ??/truthy guard. Общий ChatAttachment уточнён как string|null, без изменения исполняемого кода. В API введён точный KnowledgeFile response; nullable/legacy collection/content fields отражены в существующем типе.

Дополнительно проверены pending/not_found при исходном data:null: полученный статус сохраняется независимо от наличия предыдущего data.

Полный исходный прогон2531/2532 выявил старую имитацию reader без cancel/releaseLock и error event без обязательного backend status. Обновлён один существующий тест: настоящий status:failed, раннее завершение, cancel/releaseLock ровно1; raw error fixture сохранён. Исходный отказ сохранён отдельно.

Проверено:17 focused/22 combined/18 browser/2532 full; types{'Error': 51, 'Warn': 24}, ESLint{'errors': 183, 'warnings': 0}, новых0. Scoped6/futureCI363/format clean. Backend1064/25 reused после565 свежих хешей; production/21чужой файл/262тома/12соседей сохранены. Временный browser/server/build удалён; выпуска нет. PR/CI/интеграция и общая A/B приёмка остаются задачами итогового выпуска.

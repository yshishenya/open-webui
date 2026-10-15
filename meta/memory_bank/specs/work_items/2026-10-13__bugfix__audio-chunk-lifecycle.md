# AIRIS — безопасное завершение обработки фрагментов аудио

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-audio-chunk-lifecycle-2026-10-13-116.json

Воспроизведено на actual transcribe: первый HTTP429 возвращается при продолжающемся втором handler, и его файл уже удалён. Root cause: gather при ошибке не останавливает sibling tasks, а finally удаляет chunk inputs. Клиенты — /audio/transcriptions и file upload/indexing.

Минимальное исправление: маленький _transcribe_chunks использует native asyncio tasks/shield/gather, сохраняет ordered results и прежние HTTP/500 ошибки; в finally отменяет и ждёт только свои handlers до очистки. Локальный Whisper ждёт завершения своего существующего worker thread при отмене до использования/удаления входа. Sync metadata probe и isfile checks переносятся в существующий to_thread; алгоритм preprocessing сохраняется. Ошибка удаления остаётся нефатальной, но журналируется. Новых классов, сервисов, зависимостей и настроек нет.

- [x] Actual race воспроизведён; один testfile с двумя runnable проверками fail-before/pass-after с native asyncio/files/HTTPException, success order, failure/cancel and Whisper worker completion.
- [x] Минимальная правка; полныйbackend/4свежиеPostgreSQL,Black/Ruff/CI,сохранность,SDD,commit/push.

Upstream impact: тонкая замена gather/error block в routers/audio.py плюс маленький helper рядом с существующими STT helpers. _transcribe_whisper получает ожидание worker на отмене; Остальные providers не меняются. Billing/HTTP callers, provider payloads/requests/results и preprocessing algorithms не меняются. Success metadata/text и исходный файл сохраняются. Отмена не может остановить native Whisper thread немедленно: запрос ждёт его завершения, чтобы не удалить читаемый файл. Реальные providers/аудиозаписи пользователя не используются.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-audio-chunk-lifecycle-116-20261013. Baseline a7fce15dcdbb204578e25ec4d0de3b313fde8349:1072backend/25warnings,Black0diff,Ruff482/newCI7. Откат: revert commit. План198/244,цельactive;выпуск после общего gate.

Native asyncio: официальные Python3.11 gather/shield/to_thread semantics проверены; новых dependencies/SDK API нет. Повторная отмена при завершении не прерывает ожидание owned handlers и затем распространяется вызывающему коду.

Приёмка: native baseline2failed/current2passed;HTTP429 identity/generic500/orderedtext/async reader closure/native worker input lifetime/single and repeated cancellation. Other module/provider/billing AST unchanged. Backend1074/0ошибок/пропусков/25прежнихwarnings;4свежиеPostgreSQL. Black473unchanged;Ruff482→481/new0;scopeCI10→9/new0;branch274files6432→447/new7→6. Frontend5149hashes/2600tests/types0/0/ESLint0 reused. Production/image/env/config/mount/healthy/restarts0/21foreignfiles/262volumes preserved;33network configuration/attachments preserved,32IDs identical. Bridge ID/Created изменились во время внешней работы,эта задача Docker/bridge не перезапускала. На сервере12из14originalneighbors сохранены,2terminalnames получили новыеIDs;причина неизвестна,servermutations0. Полная неизменность neighbors/всехnetworkIDs не заявляется; дополнительная строгая33IDs проверка отказала и отражена в note. Своиfixtures/полныеbaselineкопии удалены. Общий PR/CI/выпуск впереди;план198/244,цельactive.

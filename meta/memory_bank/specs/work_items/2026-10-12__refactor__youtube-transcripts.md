# AIRIS — выбор субтитров средствами youtube-transcript-api

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-youtube-transcripts-2026-10-12-114.json

Цель: удалить повторный поиск ручных субтитров: native TranscriptList.find_transcript([lang]) уже предпочитает manual перед generated. Сохранить порядок языков, en fallback, metadata/text, proxy, ParseError/empty fallback и прежние исключения. Дополнительные debug-сообщения повторной проверки удаляются вместе с ней. Новых helpers/classes/dependencies/I/O нет. Убрать неверную list[dict[str,Any]] аннотацию: fetch возвращает native FetchedTranscript.

- [x] Прочитать module/callers/official SDK; один regression с native TranscriptList/Transcript/XML до изменения.
- [x] Удалить повтор; тот же regression после; полный backend с четырьмя свежими PostgreSQL базами, Black/Ruff/CI, сохранность, SDD, commit/push.

Upstream impact: только load и неиспользуемый импорт в upstream-owned loaders/youtube.py плюс один новый test. Синхронный SDK остаётся в существующем worker thread get_content_from_url/aload. Новых blocking calls нет. Dependency: pin youtube-transcript-api1.2.4 равен PyPI latest; официальный README/release и экспортируемые типы проверены 12.10.2026. Реальный YouTube не подменяется успехом теста.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-youtube-transcripts-114-20261012. Baseline fa23e2a22e71aa9825ca4218b1eb9d214e73aaad; backend1070, Black0diff,Ruff484,newCI9. Откат: revert commit. План198/244,цельactive; общий выпуск после обязательных проверок.

Приёмка: один regression с 12 сценариями native SDK/XML до и после; прочий AST совпал. Backend1071/0ошибок/пропусков/25прежнихwarnings,4свежиеPostgreSQL базы. Black471unchanged;Ruff484→483/new0;scopeCI2→1/new0;branch272files6432→449/new9→8. Frontend5149хешей прежние,2600tests/types0/0/ESLint0 переиспользованы. Production/image/env/config/mount/healthy/restarts0/14прежнихсоседей/21чужойфайл/262тома/33networkIDs/config/attachments сохранены. Своиcontainers/network/полныеbaselineкопии удалены. Общие PR/CI и выпуск впереди; цельactive,план198/244.

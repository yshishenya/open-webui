# AIRIS — простая проверка списка адресов

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-url-validation-2026-10-12-115.json

Цель: объединить nested WEB_FETCH_FILTER_LIST и is_host_allowed guard без изменения short-circuit и порядка проверок. validate_url получает return bool. Сохранить native validators, parser-confusing chars, схемы, hostname boundary allow/block, DNS IPv4/IPv6, отказ любых nonglobal адресов, ENABLE_LOCAL_WEB_FETCH, Sequence short-circuit, ошибки/logs. Новых функций, зависимостей/I/O нет. Прочие transport/redirect/DNS-rebinding guards не меняются.

- [x] Прочитать весь module и реальные callers; native validators/IP/host-policy regression до изменения.
- [x] Минимальная правка; тот же regression после; полный backend/4свежиеPostgreSQL,Black/Ruff/CI,сохранность,SDD,commit/push.

Upstream impact: только validate_url в upstream-owned retrieval/web/utils.py и один новый test. Синхронный DNS остаётся на прежней границе; callers используют существующие to_thread/run_in_threadpool. Новых blocking вызовов/Any нет. Общий transport не меняется; реальная сеть не проверяется тестовыми DNS ответами.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-url-validation-115-20261012. Baseline ffa8596bdd833b6c850f47b1fea41ef06784ced1:1071backend/25warnings,Black0diff,Ruff483/newCI8. Откат:revert commit. План198/244,цельactive,общийвыпуск впереди.

Приёмка: один native URL/IP/host policy regression до/после;15URLrules/7internalIPs/прочиеsequence/DNS/localfetchcases. Прочий AST совпал. Backend1072/0ошибок/пропусков/25прежнихwarnings,4свежиеPostgreSQL базы. Black472unchanged;Ruff483→482/new0;scopeCI6→5/new0;branch273files6432→448/new8→7. Frontend5149hashes unchanged/2600tests/types0/0/ESLint0 reused. Production и local foreign files/volumes/networks сохранены по receipts;servermutations0. Своиcontainers/network/полныеbaselineкопии удалены. Общий PR/CI/выпуск впереди;план198/244,цельactive.

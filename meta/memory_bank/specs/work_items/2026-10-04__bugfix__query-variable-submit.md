# AIRIS — ожидание формы перед автоматической отправкой query

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/query-variable-submit`
- SDD Spec: `meta/sdd/specs/completed/airis-query-variable-submit-2026-10-04-001.json`
- Created: 2026-10-04
- Updated: 2026-10-04

## Root cause / traced callers

setTextWithRetries вызывает асинхронный setText безawait и возвращаетtrue. Chat.initChat отправляет исходный q до разрешения формы; desktop query также не ждёт setText и отправляет исходный query. OnSelect уже использует callback, подавляемый отменой послеPR229. Прослежены все setText/insert callers и оба вызова helper. Три операции общего пути: подготовка текста, отмена/Save, решение об отправке.

## Goal / measured acceptance

- [x] Настоящий собранный Chat/редактор воспроизводит раннюю отправку сырого шаблона; ошибка не относится к окружению.
- [x] Helper ждёт завершения setText и передаёт отмену;0 повторных открытий после отмены.
- [x] URL/desktop query: доSave и послеCancel —0 отправок; послеSave —ровно1 отправка заполненногоprompt,0 нераскрытых переменных.
- [x] Существующие синхронные setter и черновики submit=false совместимы; no-DOM не отправляет текст.
- [x] Все callers, regression/fulltests, types/lint comparisons, build и настоящий браузер приняты;0 новых диагностик.
- [x] Exact-source CI/merge и SDD закрыты до нового общего кандидата. Production отдельная приёмка.

## Scope / upstream impact

Общий fork-owned helper chat.ts ждёт операцию и возвращает её результат. Минимальныеhooks в обоих MessageInput: явный boolean результатаsetText. Минимальныеhooks в Chat.initChat: решение об отправке и использование текущего заполненногоprompt. Новых зависимостей/сервисов/миграций нет. Полный путь проверяется на изолированном кандидате с настоящим редактором; HTTP обращения модели перехватываются до внешнего провайдера. Данные рабочего сервера не меняются.

## Verification / rollback

Docker Compose-first; причинное воспроизведение, существующий Vitest/E2E, строгие изменённые файлы и полное сравнение диагностик с базой437/4225/174/1503. Браузер настоящий, шаблон разбирается реальным parser/editor.0 реальных денежных/provider вызовов в изоляции. ОбщиеG14/13.11/пилот открыты. Откат отдельного source PR; общий кандидат89b869201 не выпускать до исправления.

### Source checks, 04.10.2026

До исправления оба URL и desktop варианта отправляют один запрос `Before {{NAME}}` до формы (ожидалось ноль). HTTP модели перехвачен: внешних обращений нет. Три новых проверки helper падают из-за преждевременного результата и потерянного отказа Promise.

После исправления 49/49 целевых и 443/443 полных frontend проверок проходят. Все семь изменённых файлов проходят строгий ESLint; форматирование изменённого блока сохранено без посторонних правок Chat.svelte. Полные типы 4225 ошибок / 174 предупреждения и ESLint 1503 ошибок: сравнение 4399 и 1503 диагностик с принятой базой даёт 0 новых / 0 удалённых. Этот старый долг остаётся открытым.

Backend, зависимости и миграции идентичны принятой базе: предыдущие 900 backend и 11 PostgreSQL проверок применимы к неизменённым байтам. Точного нового CI и собранного браузерного кандидата пока нет. `npm run preflight` отсутствует в package.json; вместо него выполнены существующие отдельные проверки, новый сценарий команд не добавлялся.

### Final source acceptance

PR231 source `4a6a3feee51006a8426e3a0c9ac31bb5a8dda7c3`, merge `0f1332c037e9ecc6e303d81bf37135d842325952`. All 13 observed checks are complete: 12 success / 1 configured dependency-review skip. CodeRabbit review is disabled for this base and does not prove an independent review. SDD is completed 3/3.

The actual production-format candidate passes 7 query cases and 12 guide cases (19/19). Query cases assert zero page errors, zero requests before Save and after Cancel, and exactly one filled prompt after Save. Plain queries and submit=false drafts remain compatible. Frontend build: git archive of the exact source, standard 4096 MiB heap, 4913 matching build files. All 501 immutable backend files match the retained base. This confirms isolated source/candidate acceptance; production rollout and the overall quality gate remain separate.

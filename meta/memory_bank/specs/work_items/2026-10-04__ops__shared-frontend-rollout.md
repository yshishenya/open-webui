# AIRIS — выпуск принятых исправлений общего интерфейса

## Meta

- Type: ops / bugfix completion
- Status: completed
- Owner: Codex
- Branch: `codex/bugfix/shared-frontend-rollout`
- SDD Spec: `meta/sdd/specs/completed/airis-shared-frontend-2026-10-04-001.json`
- Created: 2026-10-04
- Updated: 2026-10-04

## Context

Исходники разборщика формул, восстановления/загрузки/сохранения заметок, формы переменных/карты и отмены приняты отдельными PR216/219/223/226/229. Рабочий сервер содержит независимый выпуск аналитики/кошелька source239275712; его backend и зависимости совпадают с принятым application source89b869201. Общий новый кандидат проверяется отдельно от отдельных исходников. Integration44c6390ec включает документы закрытия PR230.

Workflow: bug_fix, этап выпуска после воспроизведения, минимального исправления, source-проверок и exact-head CI. Повторное согласование связанных операций не требуется по поручению владельца; чужие изменения/данные сохраняются.

## Goal / Measurable acceptance

- [x] Новый linux/amd64 образ использует точный текущий production digest как backend base;0 различий immutable backend/dependency files.
- [x] Frontend собран из git archive source4a6a3feee с действующим публичным идентификатором аналитики;100% файлов build совпадают с принятым кандидатом.
- [x] Изолированные проверки реального редактора/формы/заметок/карты проходят;0 необработанных ошибок страницы,0 внешних платных вызовов.
- [x] Полный действующий Compose из3 файлов сохранён;0 незаявленных изменений окружения/томов/сетей/портов/соседних контейнеров.
- [x] Резервные копии PostgreSQL/application data/конфигурации проверены по SHA256 и читаемости; прежний образ доступен для отката; миграция проходит до пересоздания.
- [x] После выпуска airis healthy/restarts0; image/files совпадают с кандидатом, число новых критических дефектов0. Денежное и почтовое состояние сохраняет заявленные границы.
- [x] План/доказательства обновлены, SDD закрыт; G14/13.11 и реальные окна пилота не объявляются выполненными частичным выпуском.

## Existing evidence / limits

Source89b869201:437/437 frontend,900 backend/5 PostgreSQL-only skips; все5 пропусков+6 lifecycle отдельно11/11 PostgreSQL16.15/0skip.31 regression/28 Chrome cancellation cases,0 pageerror. Общие типы4225/174 и ESLint1503:0 новых/0 удалённых сообщений; строгие изменённые файлы проходят. Общий долг сохраняется. Первый frontend build1536MiB упал наheap limit, штатный4096MiB проходит. Для production сборка повторяется с сохранённым действующим публичным counter ID: пустое значение непригодно.

## Scope / upstream impact / rollback

Обновляется только принятый frontend поверх проверенного неизменного серверного слоя. Новые зависимости/API/миграции/дизайн/правила проверки не добавляются. Исходники upstream-компонентов уже приняты предыдущими PR; эта работа — приёмка образа и эксплуатационный выпуск. Повторно использовать guarded deploy с полным фактическим набором Compose; конфигурацию/почтовые переключатели сохранять. При конкурентном изменении base/config остановить выпуск и повторить сверку. Откат только образа; БД не понижать/зачисления не удалять.

### 04.10.2026 — кандидат требует исправления пути query

При трассировке настоящего Chat.initChat обнаружено: setTextWithRetries вызывает асинхронный setText без await, возвращаетtrue и URL/desktop query отправляет исходную строку до завершения формы. Отмена должна остановить оба вида автоматической отправки, Save — использовать заполненныйprompt. Новый кандидат source89b869201 не выпускается до отдельного воспроизведения/исправления и повторной приёмки. Формальные исходники PR229 и его изолированные проверки не доказывали этот путь; их границы сохранены.

### 04.10.2026 — fixed candidate accepted

PR231 source4a6a3feee51006a8426e3a0c9ac31bb5a8dda7c3 merged0f1332c037e9ecc6e303d81bf37135d842325952. Exact CI accepted; source closure documents PR232 merged. Runtime candidate `yshishenya/yshishenya:shared-frontend-4a6a3feee-on-billing-20261004`, image ID4609363ce9593a00efd458f242a83505b3b738d30db827720426dcb8a10a6074, registry digest4268f1c500758439723910161c1b98628edc9b8aabe8df81e2517e675136715c.

4913 frontend files match the exact build; all501 immutable backend files match retained production base931098f3. Public counter111392024 retained. Actual browser:19 query/guide cases plus3 math/note/template-map cases accepted,0 query/shared page errors. Note title and collaborative content persisted through the real isolated API/socket and reload. Initial two shared checks failed on ambiguous test selectors; corrected without application changes and rechecked.

Full three-file Compose matches live and the candidate changes only image. Production06:12:22UTC healthy/restarts0,13 neighbors and environment hash preserved. Guarded operational copy adds the current analytics Compose, backs up config with restrictive permissions, omits orphan removal, uses no-deps and checks free space again after backup/pull. No runtime rollout yet.


### 04.10.2026 — production accepted

Guarded rollout succeeded after resolving two pre-migration operational checks: the remote engine reports registry digest as image ID, and the checkout lacked the existing compiled-counter checker. Identity was verified through all 19 layers, image environment and 4913/501 file hashes; the exact existing checker was copied to the operation backup directory and verified. Checks were retained. The existing verified backup was reused, including all four configuration files and hidden `.env` with mode0600. Hard Alembic gate passed before recreate; only airis was recreated, no orphan removal.

Production runs registry digest4268f1c500758439723910161c1b98628edc9b8aabe8df81e2517e675136715c, linux/amd64, healthy/restarts0. All4913 frontend hashes match the candidate and all501 live backend hashes match the pre-rollout live baseline. The startup-generated webmanifest was compared to the live baseline; immutable image hashes were compared separately. Runtime environment and13 existing neighbors remained identical. Opening the normal chat activated one additional per-user terminal; no retained neighbor was changed or removed. Default three-file Compose now retains the accepted image through a locked, backed-up, hash-guarded update of only the two image keys; rendered delta is only airis.image.

Actual production guide and query form accepted: Cancel closes the form, Save substitutes the value in the editor, submit=false leaves0 user messages, browser error logs0. No model request was sent for this live form check. All3 shared candidate checks pass again after formatting; strict ESLint/Prettier pass. Source4a has443 frontend tests; the candidate has19 query/guide plus3 shared browser checks. Source/dependency/backend hashes preserve prior900 backend and11 PostgreSQL checks.

SDD closed3/3. PR231/232 are merged. General type/lint debt4225 errors/174 warnings and1503 ESLint remains open; no independent desktop app, real payment, physical phone or cohort acceptance is claimed. Current inventory has0 eligible product-email opt-ins,queue0 and retained disabled sending flags. Pilot24h/72h/14d has not started. This rollout does not close globalG14/13.11.

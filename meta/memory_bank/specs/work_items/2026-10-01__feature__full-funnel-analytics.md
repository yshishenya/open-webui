# Полная воронка Airis

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/full-funnel-analytics-20261001
- SDD Spec: meta/sdd/specs/active/airis-full-funnel-analytics-2026-10-01-001.json
- Created: 2026-10-01

## Goal

Измерять наблюдаемую цепочку первого визита → регистрации → первого успешного
использования → первой подтверждённой оплаты за 7/30 дней, повторных оплат и
возвратов. Финансовые факты берутся с сервера; аналитика не влияет на зачисление.
Отчёт явно разделяет всех финансовых пользователей и посетителей, согласившихся
на аналитику. Не обещать 100% наблюдаемость посетителей без согласия или cookie.

## Acceptance Criteria

- [x] AC01: до согласия нет аналитического UUID, внешних запросов и сохранения источников.
- [x] AC02: первое касание неизменно; последняя явная кампания обновляется; direct его не стирает.
- [x] AC03: анонимный посетитель связывается с аккаунтом после email/OAuth/восстановления сессии; аккаунт берётся из авторизации.
- [x] AC04: создание аккаунта определяется сервером, повторный вход не считается регистрацией.
- [x] AC05: принятый запрос и успешный непустой ответ считаются один раз за жизнь аккаунта; ошибка/отклонение не активируют.
- [x] AC06: оплата без возврата в браузер фиксируется после подтверждения провайдером и зачисления; повторы webhook/reconcile не дублируют факт.
- [x] AC07: пропущенный при сбое факт оплаты восстанавливается; очередь переживает рестарт; повторная доставка имеет стабильный ключ.
- [x] AC08: первая/повторная оплата определяется стабильно при одновременных платежах.
- [x] AC09: подтверждённые частичные/полные возвраты дедуплицируются, проверяются через провайдера и учитываются в net revenue без изменения кошелька этой задачей.
- [x] AC10: отзыв согласия очищает клиентскую идентичность и прекращает ожидающую внешнюю доставку; старые события не воспроизводятся при новом согласии.
- [x] AC11: внешние payload содержат только разрешённые события/поля; без текста чатов, email, токенов, произвольных URL, автосбора и записи сессий.
- [x] AC12: отчёт показывает 7/30-дневные когорты уникальных первых посетителей, переходы, задержку оплаты, источники, устройства, суммы/возвраты, повторные оплаты и незрелые когорты.
- [x] AC13: Метрика и PostHog получают разрешённые события; недоступность провайдера не ломает продукт; ограничения атрибуции Метрики явно отражены.
- [ ] AC14: миграция, целевые backend/frontend/E2E проверки и контрольное прохождение подтверждены; реальные деньги не используются без отдельного разрешения.
- [x] AC15: текущие настройки целей/отчётов сверены в кабинетах и опубликованный продукт проверен на том же SHA; непройденные проверки указаны явно.
- [ ] AC16: исходный PR/release workflow завершён: изменения интегрированы в `airis_b2c`, PR129 слит или закрыт как замещённый PR130, CalVer-релиз опубликован с проверенными артефактами и явными ограничениями.

## Contract and scope

Fork-owned analytics tables/service/router: consent-bound anonymous context,
authenticated account linking, immutable milestone/event keys, durable delivery.
Frontend uses existing AnalyticsBootstrap and analytics adapter; no new SDK is
needed for allowlisted PostHog HTTP capture. Raw identifiers stay internal;
external user identity is pseudonymous. Server derives account creation from
trusted account record; client activation is an observed success signal with
server lifetime deduplication and cannot be treated as financial authority.

Financial integration reuses verified YooKassa and wallet paths. Repair reads
succeeded local payments; refunds are verified by provider API. Financial report
is authoritative for amounts; external analytics covers consented linked users.
Anonymous multi-device stitching before login is impossible and is disclosed.

Metrica offline conversions are limited to attribution windows (21 days from
last visit); do not create synthetic page views to bypass them. Internal cohort
facts/PostHog provide the 30-day user report. Browser purchases are suppressed
when server capture is authoritative.

## Verification / change discipline

Before implementation agents independently review contracts, consent lifecycle,
financial idempotency and documentation. Contradictions update this spec before
dependent edits. Docker Compose-first checks; report existing unrelated check
failures separately. Deployment requires backup/migration/health/privacy gates.

## Upstream impact

Thin hooks in main.py, auth creation, billing service/router and Chat.svelte;
all persistence/delivery/report logic lives in fork-owned modules. No unrelated
formatting. No Tilda/airis.you/Chatra edits, no Webvisor/autocapture enablement.

## Risks / rollback

External delivery is at-least-once: a timeout after provider acceptance is
ambiguous. Stable event keys and provider dedup reduce duplicates; do not claim
exactly-once transport. Disable destination flags for rollback; preserve payment
records and internal financial facts. Migration rollback only after data export.

## Progress

- Implementation and independent review complete. Local tests and migration passed.
- Production rollout and PostHog setup/delivery verified on 2026-10-01. Metrica OAuth connected; technical upload PROCESSED and linked report receipt verified at21:58UTC.
- AC01–12/14 checked against isolated automated checks; real-money/provider delivery is not claimed.
  AC13/15 accepted with explicit composed-image/browser limits below; AC16 remains pending publication.

## Production evidence — 2026-10-01

- User authorized remaining work; seven copied/verified old backup duplicates were removed. Latest prior backup was preserved, free disk gate passed.
- Fresh rollout backup: `/opt/backups/airis/20261001T190853Z-edbd07e14-funnel-20261001`; checksums, archive reading and dump listing passed.
- Deployed application source: `edbd07e149c4d340b84dfa031c714adf73e19fef`, image digest `sha256:24273c0692f2c6ce98f4a29964307e79db20e11b39cfb819d4e6409b7617e99a`, linux/amd64. Migration head `a10f20261001`. Public version.json matches source; health true; container healthy with zero restarts.
- Previous image retained for rollback. Deployment recreated only Airis. Analytics configuration persists in `/opt/projects/airis-analytics-runtime/compose.yaml` and private provider.env; production .env image/COMPOSE_FILE updated without discarding other settings.
- Published-image tests: 19 new analytics and 95 existing billing tests pass. Fresh production PostgreSQL dump restored locally and migrated successfully before rollout.
- Actual production browser: no Metrica script while denied, one after consent; welcome→pricing works. First visit with diagnostic UTM saved and delivered; event found in PostHog Team 2. Revoke removes internal events/attribution. Public report denies unauthenticated requests (401); deployed report computes 7/30-day windows.
- Metrica OAuth application created after explicit action-time approval, metrika:read/write token persisted in private runtime configuration. Counter/goals/uploadings API access verified; restart healthy, zero restarts. No real payments/refunds or fake production accounts created. AC13/15 remain open for processed provider delivery and signed-in acceptance.
- Added exact server signup goal `lead_signup_completed` (666687214) and technical delivery goal `analytics_delivery_check` (666687215). Changed four server offline goals to exact conditions preserving their IDs, as required by official offline conversion documentation.
- Actual packaged `deliver_metrica` uploaded one technical conversion for a genuine consenting browser ClientID, using an isolated in-memory database. Upload 1211156457 accepted (`UPLOADED`); no fake registration/payment or production financial event inserted. Final processing/report linkage remains pending.

## Follow-up acceptance and concurrent rollout — 2026-10-01

- User completed normal sign-in in an existing account. Production linked one consenting analytics identity to the authenticated account and recorded wallet view. Existing account was not counted as a new signup. The initial member session could not show admin analytics; user subsequently supplied an administrator session and the report was verified.
- A concurrent SMTP rollout recreated Airis as `yshishenya/yshishenya:smtp-3f89137fc-funnel-20261001` without the analytics runtime override. Default Compose still referenced the private override. Compared desired/live configuration: only five analytics environment variables differed. Recreated Airis with default Compose, preserving the SMTP image and other configuration.
- Current image digest: `sha256:02640f9e28dfa34bae60b32e7428a1fe19612eba0c652d200c335c025bfb67d1`. SHA256 of analytics service/router/models matches the tested source files. Public frontend version remains `edbd07e149c4d340b84dfa031c714adf73e19fef`; this does not attest the entire concurrently layered SMTP image source. Health true, container healthy/restarts 0, provider configuration enabled, PostHog queue delivered.
- Technical Metrica upload 1211156457 is still UPLOADED; cabinet visibly shows one row being processed, with average processing time around two hours and a 21-day visit linkage window. Do not mark provider/report acceptance complete yet.
- YooKassa runtime uses shop ID + secret (Basic Auth), with no OAuth webhook management. Official provider documentation requires notification settings in the merchant cabinet; `refund.succeeded` subscription is not externally verified. Signed-in admin report and merchant notification settings require ordinary user login; no privilege bypass or secret export.

- User subsequently completed administrator and merchant login. Actual production ProductFunnel rendered correctly for 30-day and 7-day conversion windows; existing accounts excluded from new acquisition, immature cohort shows “window not completed”, historical payment totals shown separately. Screenshot: artifacts/full-funnel-20261001/production-admin-funnel.png.
- YooKassa merchant `chat.airis.you` notification settings verified in authenticated cabinet: endpoint `/api/v1/billing/webhook/yookassa`, events payment.succeeded, payment.waiting_for_capture, payment.canceled, refund.succeeded already enabled. No setting mutation required. Screenshot: artifacts/full-funnel-20261001/yookassa-refund-notifications.png.
- Two existing accounts linked to consenting first-party analytics identities. Signed-in ClientID is still absent in local browser sessions; do not claim cross-provider signed-in identity acceptance. Genuine server-browser ClientID worked for the isolated technical upload. Real financial end-to-end acceptance remains unperformed.

- CDP network observation diagnosed local signed-in ClientID limitation: `https://mc.yandex.ru/metrika/tag.js` fails as Script with `net::ERR_BLOCKED_BY_ORB`. No browser security bypass attempted. First-party authenticated linking/report works; independent genuine server browser loaded the counter and supplied the technical conversion ClientID.

## Accepted-upload retry correction — 2026-10-01

A 4xx while reading Metrica upload status/reconciliation changed `uploaded` or `uncertain` to `pending`, allowing a duplicate POST after access recovered. Reproduced with six isolated checks (401/404/429 for both states), all failing before correction. Minimal fix allows reset to pending only for an explicitly rejected POST; failed GET preserves the existing state/upload ID. After correction all 25 analytics tests pass. No new dependencies, API/schema/frontend changes. Corrected module deployed and verified in the image below; AC07 closed again. The existing SMTP layer is preserved.

### Retry correction rollout evidence

- Delta source: `360f62478188db480bad84a56d58c6f9896f19da`; only runtime change is the POST-method guard in analytics.py.
- Image built on Mac: `yshishenya/yshishenya:360f62478-metrica-retry-20261001`; registry/running digest `sha256:02a53a23bd08aeb829ff5c8c4cbaa39b5de878e9a4841db239c137691ce828b0`, linux/amd64. Immutable parent is the current SMTP image digest `sha256:02640f9e28dfa34bae60b32e7428a1fe19612eba0c652d200c335c025bfb67d1`; copied only analytics.py. Frontend version remains edbd07e149c4d340b84dfa031c714adf73e19fef; SMTP source label remains 3f89137fc4668b6b9adb6be34f328bf8e60f6fbb.
- All 25 analytics tests passed inside the packaged image. Scoped Ruff and project-config Black passed. Six regression cases fail before the guard and pass after.
- Source/image/production analytics.py SHA256: `711fca922bbde36bb6c8455287bd2fc82e9a9eeb120b422389e1b9828374a170`.
- Earlier own backup 20261001T190853Z-edbd07e14-funnel-20261001 moved to Mac after full SHA256/archive/pg_restore-list validation. Latest SMTP backup retained on server; 10 GiB pre-rollout disk gate passed.
- Fresh backup `/opt/backups/airis/20261001T200208Z-360f62478-metrica-retry-20261001` verified, permissions restricted. Alembic head a10f20261001 checked, service-only guarded rollout completed, previous SMTP image retained for rollback. Persistent image tag updated preserving all other .env bytes.
- Production healthy/restarts0; all provider settings present after restart. Metrica technical visit appears in stat API as one visit without sampling, while technical goal reaches remain zero and upload1211156457 remains UPLOADED. AC13/15 remain open for final offline processing/report receipt.

## CI refresh and documentation audit — 2026-10-01

- PR source head `360f62478188db480bad84a56d58c6f9896f19da`: [backend pytest run 36918174265](https://github.com/yshishenya/open-webui/actions/runs/36918174265) passed, 439 tests / 136 warnings. CI tested the generated PR merge ref; this is separate from packaged runtime evidence. The earlier langchain_community collection failure did not recur in this run.
- [billing-confidence run 36918174131](https://github.com/yshishenya/open-webui/actions/runs/36918174131) passed backend critical, frontend balance and browser wallet suites. Backend lint remains failing on baseline violations; full frontend typecheck/preflight limitations remain documented. New docs commits trigger their own checks; do not reuse previous success as their exact-head CI proof.
- Independent final review found no missing required provider configuration in the agreed scope. Updated guide removes stale claims about missing Metrica OAuth/project access, documents current cabinets, browser limitations and accepted-upload recovery.
- Live runtime rechecked after docs commit: current retry image, analytics module SHA256 match, healthy/restarts0, public health true; frontend remains edbd07e149c4d340b84dfa031c714adf73e19fef. AC13/15 and SDD verification remain open for processed offline conversion and linked report receipt.

## Missing delivery after runtime configuration outage — 2026-10-02

Live read-only audit found a consented post-cutoff billing_wallet_view without PostHog delivery, while three first-visit deliveries exist. Root cause: destinations are selected only during first event insertion; duplicate-event recovery exits before creating missing delivery. Configuration restore cannot repair these gaps. AC07 reopened until bounded recovery is tested/deployed and the genuine missing wallet event is delivered. Existing delivery states/upload IDs must remain intact; no synthetic financial facts or reset of accepted uploads.

Recovery rollout capacity: server available9515836KiB (~9.08GiB), current backup ~1.5GiB and module delta <1MiB. Use explicit8GiB minimum for this rollout; expected remaining >7GiB after backup. The disk gate stays enabled. Previous SMTP backup is being copied to Mac; original remains on server until complete validation, so rollout does not depend on deleting it. Latest prior runtime backup preserved.

Recovery implementation: bounded anti-exists repair with current consent/grant/cutoff, existing identity locks/unique destination constraint and Metrica goal allowlist. Disabled destination skips transmission/attempts and pending query excludes unavailable destinations. One regression fails on immutable previous image (attempts4→5); corrected overlay runs26analytics tests successfully. Scoped Ruff/Black passed. No schema/frontend/dependency changes. Deployment and genuine missing-event receipt pending.

## Configuration recovery live acceptance — 2026-10-02

- Source `c4484454a95c5d0d3a978a19d25518a836d8ed48`; Mac-built linux/amd64 image `yshishenya/yshishenya:c4484454a-delivery-recovery-20261002`, digest `sha256:610c1a3347baa97f2392160029e6aadc6ffcb87ac364efd6b613eee780bdb8ea`. Immutable parent is prior retry digest02a53a23…, only analytics.py copied. Public frontend remains edbd07e149c4d340b84dfa031c714adf73e19fef.
- Source/image/live module SHA256 `a5cece1af1edbd962420bc2ecafd48a719348a0af9d9355eb72b6e8e9d5a9fe0`. All26analytics tests pass in actual packaged image; existing guard regression fails on previous image. Scoped Ruff/Black passed; no schema/frontend/dependency changes.
- Fresh backup `/opt/backups/airis/20261001T211731Z-c4484454a-delivery-recovery-20261002` passed SHA256/archive/pg_restore-list; Alembic a10f20261001 unchanged. Service-only guarded rollout completed, previous image retained. Explicit8GiB preflight capacity gate passed. Existing image-tag lines persisted without modifying other env bytes; private backup retained.
- Production healthy/restarts0/healthtrue; both destination settings restored. Previously missing wallet delivery now delivered: four PostHog deliveries, no pending/error jobs. Warehouse query for actual billing_wallet_view: before rollout no rows; after rollout one row, errornull. AC07 closed on actual recovery evidence, not only mocked tests.
- Previous SMTP backup copied to `/Users/yshishenya/Documents/Airis-production-backups/2026-10-02-transfer/20261001T193209Z-smtp-3f89137fc-funnel-20261001`; all3hashes,735archive members and pg_restore-list verified. Deleted only verified server duplicate after manifest equality; both newer runtime backups retained.
- Metrica upload1211156457 is still under read-only watch; AC13/15 remain open until processed/report receipt. No new conversion upload or synthetic financial event produced by this recovery.

## Original release workflow acceptance — 2026-10-02

Final objective audit found the original attachment step7 still has an open release tail: PR129 and PR130 are open; v2026.09.30.1 remains draft, target041343b4b. Source PR129 HEAD91f8136e4 is an ancestor of the full-funnel branch, verified by git merge-base. AC16 records this existing requirement rather than treating PR creation as release completion. Latest integration98cef2542 merged into the full-funnel branch; only navigation-test conflict resolved, preserving analytics and concurrent guide/SMTP changes.143frontend tests and scoped lint/format pass; independent combined-hook/config audit found no mandatory defect. No new production deployment from this source integration has been performed.

## Итог внешней доставки и сверки — 2026-10-02

- AC13: загрузка Метрики `1211156457` получила `PROCESSED` в 21:58 UTC
  2026-10-01, `linked_quantity=1`. API отчёта: 1 визит, 1 достижение технической
  цели `666687215`, `sampled=false`. Повторный POST не выполнялся. PostHog
  подтверждён настоящими событиями и восстановлением пропущенного wallet view.
  Техническая цель не является регистрацией или покупкой.
- AC15 принят с явными границами: настройки целей/PostHog/YooKassa и прежняя
  admin-проверка 7/30 дней подтверждены. Текущий составной digest `f2de…` сохраняет
  все 11 backend-файлов из PR и все 4836 файлов контекста frontend build,
  включая 931 immutable, без различий. Исходники frontend аналитики совпали
  с PR `a472…`. Это не образ всего репозитория из единственного SHA. Повторная
  admin UI проверка после guide overlay не подтверждена: прежняя вкладка
  недоступна CUA, свежий сеанс обычный и перенаправляется с `/admin/analytics`.
  Привилегии не менялись.
- Публичный health HTTP 200 / status true, контейнер healthy/restarts 0 и frontend
  marker `guide-7c419a9d3-on-360f62478` повторно проверены в 22:08 UTC. Mock и
  staging safety/health probes прошли; staging probe не совершает платёж.
- Текущий код `a472…` прошёл 440 backend-тестов и все 3 набора pr-fast.
  PR130 слит в `b3838f705309e13cb54dd2cdf8b9e95f277183f7`; дерево merge commit
  полностью совпало с `a472…`. GitHub автоматически отметил PR129 как MERGED.
  Расширенный release-heavy `36933103407` запущен с enforce_gate=true;
  merge-medium `36933548202` запущен на интеграционном commit. Их результат
  не объявляется успешным заранее. AC16 остаётся открытым до публикации.

## Release coverage correction — 2026-10-02

Enforced release-heavy36933103407: four suites passed. Coverage pack209tests
passed, but utils/billing line84.50% failed required85% (branch75.65% passed).
The new refund.succeeded BillingService boundary is absent from this pack's
executed lines. Add focused delegation/validation/error tests in the existing
webhook status test file, without runtime edits or threshold changes. AC14
reopened until coverage and enforced release checks pass. Workflow: bug_fix;
branch codex/bugfix/full-funnel-release-coverage-20261002 from merged b3838f705.

Correction implemented:6targeted refund boundary checks pass. Full local
Docker Compose coverage pack215tests passes; unchanged checker reports
routers91.58%line/79.21%branch and utils85.85%line/76.62%branch, gatePASS.
No runtime changes, dependencies or threshold reduction. CI rerun pending.

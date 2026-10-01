# Полная воронка Airis

## Meta

- Type: feature
- Status: active
- Owner: Codex
- Branch: codex/feature/full-funnel-analytics-20261001
- SDD Spec: meta/sdd/specs/active/airis-full-funnel-analytics-2026-10-01-2015.json
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
- [ ] AC13: Метрика и PostHog получают разрешённые события; недоступность провайдера не ломает продукт; ограничения атрибуции Метрики явно отражены.
- [x] AC14: миграция, целевые backend/frontend/E2E проверки и контрольное прохождение подтверждены; реальные деньги не используются без отдельного разрешения.
- [ ] AC15: текущие настройки целей/отчётов сверены в кабинетах и опубликованный продукт проверен на том же SHA; непройденные проверки указаны явно.

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
- Production rollout, PostHog project setup and observed provider delivery remain open.
- AC01–12/14 checked against isolated automated checks; real-money/provider delivery is not claimed.
  AC13/15 remain open for external delivery and production acceptance.

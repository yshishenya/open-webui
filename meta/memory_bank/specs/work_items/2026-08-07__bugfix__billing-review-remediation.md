# Billing review remediation

## Meta

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: `codex/bugfix/billing-review-fixes`
- SDD Spec: `meta/sdd/specs/completed/billing-review-remediation-2026-08-07-310.json`
- Created: 2026-08-07

## Goal

Устранить подтверждённые финансовые, security и UX/UI проблемы, найденные при повторном ревью billing/reporting после синхронизации с `airis_b2c`, и добавить регрессионные проверки.

## Scope

- Fail-closed settlement для успешных non-streaming ответов.
- Корректная пагинация и bounded reporting aggregates.
- Ограничение ledger/usage CSV export одним клиентом.
- Проверка активности тарифов и стабильная YooKassa idempotency.
- Безопасная metadata-only top-up recovery и CSV formula protection.
- Корректное multi-currency отображение и доступность admin billing UI.
- Проверка migration expiry backfill; уже применённую миграцию не редактируем задним числом.

## Verification

- Targeted backend regression tests for every corrected path.
- Targeted frontend tests, ESLint and Svelte typecheck for changed billing pages.
- Ruff/Black, migration validation, `git diff --check`.
- Full code/security review after fixes; manual Chrome review was not run because no local app server or authenticated target was available.

## Result

- Confirmed findings are fixed in runtime code and covered by targeted regression tests.
- The already-applied `b4c5d6e7f8a9` migration was intentionally left immutable; expiry-bucket redesign requires a separate additive migration and ledger model decision.
- Full async backend suite could not run in the local Docker image because `pytest-asyncio` is absent; sync backend checks, targeted frontend tests, ESLint, compileall, Ruff, and diff checks passed.

## Upstream impact

Изменения ограничены billing-owned routers/services/models/migrations, reporting API и admin billing UI; новые зависимости не добавляются.

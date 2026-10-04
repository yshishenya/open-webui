# Исправить дневные денежные графики PostgreSQL

- Type: bugfix
- Status: in_progress
- Owner: Codex
- Branch: codex/bugfix/billing-report-postgres-days
- SDD Spec: meta/sdd/specs/active/analytics-billing-ui-2026-10-04-118.json

## Goal / Acceptance Criteria

Денежный обзор на production PostgreSQL возвращает суммы и дневные серии, соответствующие пополнениям, возвратам и расходам. Проверка должна падать до изменения и проходить после на PostgreSQL 16 и SQLite. Исправление публикуется поверх проверенной UI версии без изменения интерфейса, настроек платежей и данных.

## Cause / fix

SELECT и GROUP BY создавали отдельные SQLAlchemy выражения floor(timestamp / 86400). Разные bind-параметры воспринимаются PostgreSQL как разные выражения; SQLite это допускал. Одно выражение на каждый из трёх запросов используется дважды. Переиспользуется полная существующая проверка денежного отчёта на отдельной временной базе PostgreSQL; драйвер установленный psycopg.

## Upstream impact

Только Airis-owned billing_reporting.py и его существующий тест. Нет зависимостей, миграций или изменений контрактов.

## Verification / rollout

Red: old exact image + PostgreSQL full report fails GroupingError, SQLite passes. Green: 11 reporting checks pass including the same full report on fresh PostgreSQL16. Black changed files and Ruff changed files pass. Pending: independent review, PR and exact one-file image overlay. Public acceptance belongs to the existing active task-2-2.

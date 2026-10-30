# Оценка обновления Open WebUI v0.12.5

## Meta
- Type: docs
- Status: done
- Owner: Codex
- Branch: codex/docs/upstream-v0.12.5-assessment-20261029
- SDD Spec: meta/sdd/specs/completed/open-webui-0125-compatibility-2026-10-29-454.json
- Created: 2026-10-29

## Context
Пользователь просит оценить возможность безболезненного обновления форка. Это исследование, без внедрения изменений приложения или выпуска.

## Goal / Acceptance Criteria
- [x] Подтвердить официальный выпуск и актуальную интеграционную ветку.
- [x] Выполнить пробное слияние в изолированной рабочей копии и зафиксировать конфликты.
- [x] Проверить зависимости, миграции и пересечения с изменениями AIRIS.
- [x] Сохранить вывод и необходимые условия обновления.

## Upstream impact
Изменения рабочих файлов апстрима не сохраняются; пробное слияние будет отменено. Изменяются только этот документ, журнал ветки и SDD.

## Verification
Проверка официального тега, пробное слияние, статический анализ миграций и зависимостей. Полные тесты Docker, сборка и браузерная проверка нужны после разрешения конфликтов в отдельной задаче обновления.

## Results
- Fresh baseline: `59d2abfb30c4837b079d4e7bf0d42746744ba9c2`; official target: `f7ac7ee10962ddec0017f5c29b6740d9b9c5faca`.
- Common ancestor v0.11.0. Ordinary trial merge: 448 conflicted paths; ignore-all-space: 447 (98 backend, 338 src including 63 translations, 11 other); 3002 marker blocks. Both trials aborted.
- Combined migration graph: 87 revisions, two heads (`d1c020261009`, `0bd252b206fb`), 11 new upstream revisions. Requires merge revision and PostgreSQL rehearsal before `upgrade head`.
- Python 3.12/Debian 13 candidate conflicts with current Python 3.11 production lock; MCP 1.27.2 → 2.3.0 requires aligned client and dependencies. Preserve AIRIS SMTP/email validation and clean-build hooks.
- Verdict: automatic low-risk update is not available; a separate integration and acceptance task is required. No application changes or deployment.
- Full report and evidence: `/Users/yshishenya/Documents/Codex/2026-10-29/upstream-v0.12.5-assessment/ASSESSMENT.md`.
- Full Docker/backend/frontend/browser/PostgreSQL tests were not run: no merged runnable candidate exists; these are release gates for subsequent integration, not evidence for this assessment.

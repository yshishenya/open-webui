# Настройки оценки моделей и рейтинг

Status: Done (local acceptance; global release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-evaluation-settings-2026-10-11-045.json

- [x] Проследить четыре API и все потребители; воспроизвести потерю черновика при отказе и замену свежего рейтинга/истории старым ответом.
- [x] Использовать существующие requestJSON/Model/права и точные типы серверных данных. Сохранение ожидает подтверждения; форма сохраняет поля при отказе; старый ответ не заменяет новый.
- [x] Полный frontend/type/lint, новых диагностик0; сохранить CSS, соседние API, сервер/чужие данные; SDD/commit/push и планы.

Upstream impact: evaluations/index.ts и существующие компоненты Settings/Evaluations,
ArenaModelModal/Model, Leaderboard/LeaderboardModal/ModelActivityChart. Общие данные
остаются в существующем API; новых библиотек, сервисов и миграций нет.
Прямой callback сохранения переиспользует подход PromptEditor вместо попытки await
Svelte dispatch, который не ожидает обработчики. Права моделей сохраняются.
Реальная production настройка и рейтинг не изменяются при локальных проверках.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-evaluation-settings-20261011.
Общие критерии A/B и календарные окна остаются открыты.

Локальная приёмка:20/20новых,39/39целевых,2267/2267frontend; тот же набор до3pass/17fail.
Types457/63→409/63,ESLint517→509; новых диагностик0.
250CI lintцелей и новыйtestfile0/0; оформление прошло.
График: runtime декларации и разметка идентичны; CSS всех компонентов сохранён.
Backend1064/25warnings reused по565хешам; нового прогона нет.
Production healthy/restarts0,12соседей,21чужойфайл/262тома сохранены.
SDD0453/3closed. Общее качество/PR/CI/выпуск/A/B остаются открыты.

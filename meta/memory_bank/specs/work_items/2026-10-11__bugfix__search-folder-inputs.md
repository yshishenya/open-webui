# AIRIS — выбор в поиске и фон папки

- Workflow: bug_fix
- Status: locally accepted; global checks / PR / CI / release pending
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-search-folder-inputs-2026-10-11-078.json

## Критерии

- [x] SearchModal и все родители FolderModal прослежены; existing stores, формы и loading generation переиспользуются.
- [x] Воспроизвести Enter после наведения и смены списка; отмену выбора картинки, ошибку чтения и поздний результат после смены/закрытия папки.
- [x] Сохранить подсказки/IME/навигацию/события поиска и прежний payload папки. Минимальные проверки ввода, без новых зависимостей/сервисов.
- [x] Пройти целевые и полный frontend; новых диагностик0, scoped lint/формат проходят; CSS неизменен.
- [x] Подтвердить сохранность production/чужой работы/томов, commit/push и план198/244; цель active.

Upstream impact: только SearchInput.svelte и FolderModal.svelte. Inline обработчики используют DOM и FileReader; типы отражают действительные данные. Прежние загрузка/сохранение папки, права, Knowledge, фон и API сохраняются. Откат revert commit.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-search-folder-inputs-20261011`. Общие проверки/PR/CI/выпуск и реальные A/B отдельно. E2E выпуска будет выполнен на финальном SHA; этот компонентный блок отдельно не развёртывается.

## Принятый результат

Исходные28 сценариев:16 pass/12 fail. Дополнительный случай индекса−1:28/29 до исправления нижней границы; затем29/29 targeted. Полный frontend2462/2462, failed/pending/todo0; types124 →110/24, ESLint195 →191, новых0. Scoped lint0/Prettier pass; будущий CI347 целей0 ошибок, актуальная базаairis_b2c сверена. Четыре client/server компиляции успешны, CSS сохранён;267 SDD валидны/эта спецификация3/3 completed. Backend1064/25 переиспользован после565 свежих хешей. Production healthy/restarts0;12 соседей/21 чужой файл/262 тома сохранены. Вывод запроса в консоль удалён, подпись кнопки фона доступна по настоящему id. Выпуска и нового браузерного E2E прогона нет.

- [ ] Общие проверки/PR/CI/интеграция/выпуск и реальные A/B; план198/244, цель active.

# AIRIS — просмотр HTML/SVG в чате

- Workflow: bug_fix
- Status: completed (исходники; выпуск pending)
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-artifact-preview-2026-10-11-082.json

## Критерии

- [x] Прослежены Chat.getContents → artifactContents, ContentRenderer.previewHandler → artifactCode и оба размещения Artifacts в ChatControls. HTML CSP/sandbox, SVG очистка, копирование/загрузка/переходы сохраняются.
- [x] Actual-source: исходные10 случаев0 pass/10 fail. Изолированное/отсутствующее окно, target без closest, индекс при сокращении списка/первом открытии, отказ fullscreen и private журналы воспроизведены.
- [x] Минимальные проверки в существующем компоненте; string|null контракт artifactCode. Сохранять sandbox/CSP и не давать дополнительного доступа/навигации.
- [x] Actual-source и compiled-browser сценарии проходят; полный frontend/type/lint без новых замечаний, scoped lint/формат pass.
- [x] Production/данные/21 чужой файл/262 тома/12 соседей сохранены; план198/244,цель active. Commit/push проверяются отдельной квитанцией source-remote-receipt.json.

Upstream impact: Artifacts.svelte — локальные проверки DOM входов и индекса; типы существующего fullscreen API. stores/index.ts — artifactCode тип. ContentRenderer.svelte — убрать raw code log и any приведение в вызове store. Новый один файл проверок. Новых зависимостей/подсистем/API/миграций нет. Основную копию и current_tasks не править.

Доказательства: `/Users/yshishenya/.codex/private-artifacts/airis-artifact-preview-20261011`. Общие проверки/PR/CI/выпуск и настоящие A/B открыты; откат revert commit.

Браузер до исправления подтвердил3 page errors: изоляция iframe, запрет pushState для srcdoc URL и индекс после сокращения. Первый preview выбирал third вместо запрошенного first. Текущие11 focused и16 compiled-browser сценариев прошли с0 page errors; parent document остаётся недоступным в default sandbox. Фрагменты используют native location.hash; запрещённое изменение URL/ошибочный href и fullscreen отказ показывают существующую безопасную ошибку. External links в читаемом окне по-прежнему блокируются. Один dragstart handler вместо добавления при каждом hover. Подписки сначала получают список, затем выбранный код; индекс ограничен доступными версиями. Raw code logs удалены. Aria-label трёх существующих иконок взяты из прежних переводов. Browser scope: настоящий Artifacts/icons/CSP/SVG sanitizer/panzoom; fixture stores/toast/copy и Tooltip placeholder, без backend/API/личных данных. Native download выбранной версии проверен по содержимому/размеру/SHA256. Предупреждение браузера об opt-in allow-scripts+allow-same-origin ожидаемо для сохранённой пользовательской настройки; её права не расширялись.

Первый полный прогон2512/2512 прошёл, types69/24, ESLint190,new0; scoped lint выявил2 прежних неиспользуемых импорта createMessagesList/ArrowLeft. Utils остаётся импортирован через copyToClipboard; ArrowLeft — чистый SVG-компонент без побочных действий. Оба неиспользуемых импорта удалены; браузер и полный прогон повторяются. Первый набор сохранён в before-unused-import-removal/. Проверяем только прежние ограничения, без расширения sandbox.

Финальная приёмка12.10.2026:11 focused/16 compiled-browser/2512 full прошли, failed/pending/todo0; page errors0. Types80 →69/24, ESLint191 →188, новых0. Scoped lint/формат4 файлов pass;356 будущих целей CI clean.4 client/server компиляции/CSS identical, store runtime JS exact;271 SDD valid/3 задачи этой спецификации completed. Backend1064/25 reused после565 свежих хешей, нового backend прогона нет. Первый набор с двумя scoped-замечаниями сохранён; после удаления unused imports оба браузерный и полный наборы повторены. Временный браузер/HTTP server/build/download удалены; контрольные суммы/журналы сохранены.
Production healthy/restarts0, image/env/config/mounts/12 соседей/21 чужой файл/262 тома неизменны. Общие проверки/PR/CI/интеграция/выпуск и настоящие A/B pending. План198/244, новых номерных закрытий0; цель active. Exact source/remote/clean после commit — source-remote-receipt.json.

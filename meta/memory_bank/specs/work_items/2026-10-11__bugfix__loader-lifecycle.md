# Общая подгрузка списков

Status: Done (local acceptance; release pending)
Workflow: bug_fix
Owner: Codex
SDD Spec: meta/sdd/specs/completed/airis-loader-lifecycle-2026-10-11-054.json

- [x] Проследить 16 мест использования Loader в 15 компонентах: событие visible раз в 100 мс, запрет повторной загрузки принадлежит родителю.
- [x] Воспроизвести накопление таймеров при повторном уведомлении видимости; оставить один таймер и освобождать его при скрытии/удалении.
- [x] Пройти целевую и полную проверку, сохранить чужие данные, закрыть SDD, commit/push.

Минимальная правка: clearInterval перед созданием следующего интервала,
типы существующих браузерных API и удаление unused параметра callback.
Период, событие, наблюдатель и родительские операции сохраняются.

Дополнительно удалить common/Selector.svelte: нет импортов, динамических
загрузчиков или потребителей. Действующий chat/ModelSelector/Selector.svelte
и используемый common/Select.svelte сохраняются. Ссылки старого generated
codebase.json не являются потребителями. Не создавать новый слой выбора.

Upstream impact: src/lib/components/common/Loader.svelte и удаляемый
src/lib/components/common/Selector.svelte. Зависимости не меняются.
Используются знакомые уже проверенные Svelte 5.56.0 lifecycle и stdlib
IntersectionObserver/setInterval/clearInterval; официальные Svelte
контракты прочитаны в 053. Новой библиотеки/интеграции нет.
Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-loader-lifecycle-20261011.
План 198/244, общая цель active; выпуск и реальные A/B открыты.

Итог: исходник 0/1 на окончательной регрессии (2 события вместо 1); после 4/4. Frontend 2337/2337, types 255/58, ESLint 399, новых диагностик 0; 277 целей CI без замечаний. Остальной emitted JS и CSS сохранены после явно перечисленных изменений таймера. Backend 1064 по 565 хешам; production/12 соседей/21 чужой файл/262 тома сохранены. SDD 2/2; выпуск и реальные A/B открыты.

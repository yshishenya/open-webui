# Сохранённая полная проверка frontend для производственного дерева AIRIS

- Type: docs / operational acceptance
- Status: done — пробел доказательств frontend закрыт; полная A/B открыта
- Owner: Codex
- Branch: codex/docs/release-127-acceptance
- Workflow: code_review / operational acceptance
- SDD Spec: N/A — сверка существующих неизменяемых Git-объектов и отчётов; без изменений приложения.
- Related: [предыдущая сверка CI](2026-10-31__docs__current-source-acceptance-evidence.md), [оставшиеся условия](2026-10-16__docs__remaining-onboarding-gates.md).

## Проверено

- [x] Найти исходные результаты полной frontend-проверки кандидата PR #389, не повторяя уже принятые наборы.
- [x] Сравнить полные деревья кандидата f9774ba73fde217703f976c18de68b0ab9a2db36 и production source 59d2abfb30c4837b079d4e7bf0d42746744ba9c2: оба 0ea700fb53f8c44090f1cd74b53813acb8458bc9.
- [x] Независимо сопоставить все 7193 path/mode/blob из сохранённого манифеста с git ls-tree производственного исходника; before/after содержат 0 mismatches. SHA256 package-lock.json совпал с provenance.
- [x] Прочитать frontend.xml: 2868 testcase, 0 failure/error/skipped. Сохранённые стадии test:frontend/check/lint:frontend/build:vite/preflight завершились 0; summary pass, tracked_source_unchanged=true.
- [x] Проверить GitHub run 40586119479: completed/success, head_sha равен кандидату f977. Основной release-heavy summary содержит 7/7 pass, failed/timed_out=0; команды и коды 0 всех семи наборов сохранены. Искусственные smoke-проверки не смешивались с результатами приложения.
- [x] Сохранить ссылки/хеши доказательств, опубликовать отдельное дополнение в документацию и сохранить чужую основную копию.

## Что теперь доказано

Отсутствие общего frontend workflow в merge check-runs не означает отсутствия полной проверки: до merge она выполнена на другом commit с полностью одинаковым деревом исходников. Общая frontend-проверка, проверка типов, линтер и Vite build имеют прямое доказательство для производственного содержимого. Расширенный Billing Confidence также доказан для этого содержимого; он добавляет backend_billing_full_pack к предыдущим шести наборам merge-medium. Коммиты, дерево, тестовая среда и production image — разные идентификаторы; тестовый образ не выдан за производственный.

Полная frontend-проверка не равна полному onboarding E2E, проверке на физическом телефоне, социальной авторизации владельца, независимому пилоту или финансовой приёмке. Отдельные пользовательские/администраторские условия другого billing-аудита здесь не закрывались; чужая задача не изменялась. Новых реализационных пробелов, требующих правки приложения в пределах этой сверки, не установлено.

## Доказательства

Исходный каталог: /Users/yshishenya/Documents/Codex/2026-10-27/airis-billing-labels/drafts-preflight-f9774ba73/evidence. Прочитаны provenance.json, tracked-manifest.json, manifest-before.json, manifest-after.json, frontend.xml, stages.tsv, summary.json; их SHA256 сохранены в frontend-tree-parity.json.

Расширенный прогон: /Users/yshishenya/Documents/Codex/2026-10-27/airis-billing-labels/drafts-release-heavy-40586119479/billing-confidence-40586119479-1-release-heavy/40586119479-1-release-heavy/summary.json. [GitHub run](https://github.com/yshishenya/open-webui/actions/runs/40586119479), [PR #389](https://github.com/yshishenya/open-webui/pull/389). Описание PR использовано только для поиска; вывод основан на исходных XML/JSON/манифесте и проверенном head_sha.

Закрытый каталог этой сверки: /Users/yshishenya/.codex/private-artifacts/airis-frontend-parity-20261031. Оригинальные доказательства другой задачи только читались; зависимости, сборки и архивы не копировались.

## Оставшиеся условия и проверки

- [ ] Полная A.01–A.09/B.01–B.06: физический телефон, применимые самостоятельные социальные входы/повтор, независимые участники/полезность, второй оператор/применимые тексты, подтверждение оплаты/чека и исторических документов, применимые реальные письма/внешний ответ. Требуемые свидетельства не появились от проверки сохранённых тестов.

Общая цель active/incomplete; это второй последовательный проход после возобновления, с теми же внешними условиями, но новым подтверждённым техническим доказательством. B выключен, состав и согласия не менялись, Proton/HOSTKEY отложены. Исходная остановка наблюдения 06.11.2026 05:00:18 Europe/Istanbul сохранена.

Новые тесты/сборка/развёртывание не запускались; полный уже принятый регистрационный отчёт не повторялся. Приложение, деньги и почта не изменялись. Для этого дополнения проверены ссылки, область изменений и git diff --check; публикация/сохранность основной копии фиксируются отдельно. Upstream impact: none.

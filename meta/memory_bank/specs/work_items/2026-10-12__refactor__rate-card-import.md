# AIRIS — простой импорт цен из Excel

- Type: refactor
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-rate-card-import-2026-10-12-109.json

Цель: убрать два C901 в существующих parse_price_kopeks и parse_import_workbook. Единая проверка числа после преобразования строки; чтение optional columns через существующий header_map. Без новых помощников, классов, зависимостей, изменения API и денежных правил. Сохранить int без преобразования во float, отрицательные/дробные/пустые/нечисловые значения, boolean, точный порядок ошибок, duplicate headers, defaults и отключённые строки.

- [x] Прочитать модуль и все вызовы preview/apply; добавить один тест цен/полей/ошибок, пройти до изменения.
- [x] Минимальная правка; сравнение baseline/current, существующие API проверки, полный backend с PostgreSQL, Black/Ruff/CI, сохранность; закрыть SDD, commit/push.

Upstream impact: существующий fork-owned utils/rate_card_xlsx.py; новая небольшая регрессия использует уже установленный pytest/openpyxl3.1.5. Загрузчик workbook, вычисление плана, транзакции и доступ не меняются. XLSX parsing остаётся за существующей run_in_threadpool границей. Новых I/O и Any нет.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-rate-card-import-109-20261012. Baseline790db5775684cffbf74c0868345f8b1c8bacdb35:1065 backend,25warnings,Black0diff,Ruff493/CI17. Откат:revert commit. Общая цель active, план198/244; выпуск отдельно после полного gate.

Приёмка: 1066 backend, 0 ошибок/пропусков, 25 прежних предупреждений; окончательный запуск на четырёх новых временных PostgreSQL-базах. Новый и 9 прежних API тестов до/после на SQLite/PostgreSQL; 2075 сравнений цены и 56 файлов Excel совпали, AST остальных функций прежний. Black466unchanged; Ruff493 → 491, новых0; изменения ветки17 → 15 C901. Frontend5040хешей прежние. Production/12 прежних соседей/21 чужой файл/262 тома/33 сети сохранены; три новых внешних terminal-контейнера оставлены без изменений. Временные службы, сеть и полные копии удалены. Повтор на использованной report_final отказал DuplicateTable до бизнес-проверок; журнал сохранён, итоговый запуск использует новые базы. Исходники приложения для этого не менялись. Цель active, план198/244, выпуска не было.

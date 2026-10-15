# AIRIS — типы строки выбора модели

- Workflow: refactoring
- Status: locally done
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay

Тривиальное уточнение существующих типов в одном компоненте, без нового алгоритма/подсистемы/зависимости; отдельная SDD не требуется. Использовать items[number] единственного родителя Selector через ComponentProps (type-only), существующий Model для copy/delete, HTMLImageElement для img currentTarget. Убрать невозможный пустой default item: настоящий родитель всегда передаёт полную строку. Не создавать фиктивную полную модель или type assertion для пустого объекта.

- [x] Проследить единственный caller ModelItem и ModelItemMenu, модели/метаданные/теги и callback delete/copy.
- [x] Типы соответствуют действительному родителю; badge, выбор, меню и запросы сохранены.
- [x] Проверить compiled client/server diff, полный frontend/type/lint/format и отсутствие новых замечаний.
- [x] Документация, commit/push и совпадение tested source; сохранение production/чужих данных.
- [ ] Общие выпуск и критерии A/B.

Upstream impact: только объявления типов, удаление пустого default и доказанная по соседнему guard non-null аннотация tags. CSS/строки/обработчики/permissions не переписываются. Existing locked Svelte5.56/TS5.9; ComponentProps — существующий pattern Messages, новых imports runtime нет.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-model-item-contract-20261011 . План198/244, цельactive.

## Результат

Окончательный frontend 2379/2379, failed/pending/todo 0. Types 178/34 → 174/34, ESLint 276 → 274; новых замечаний 0. Изменённый файл ESLint 0/0 и Prettier pass. Будущий CI: 331 цель, 67 прежних замечаний. Общие проверки остаются unsuccessful.

Использован NonNullable<ComponentProps<typeof Selector>['items']>[number]: в первом полном прогоне items оказался необязательным и требовал исключения undefined. Исправлена только аннотация, затем полный прогон повторён на окончательных исходниках. Первые журналы сохранены в attempt-1. В private checker исправлена строковая подстановка $$, приложение для этого не менялось. Ошибочная команда запуска контейнера завершилась до запуска проверок; настоящий повторный прогон выполнен отдельно и завершён.

Скомпилированные client/server JS/CSS совпадают с прежними, кроме удаления empty item fallback (флаги lazy default и fallback getter). Все остальные runtime imports, handlers, model badge, markup, permissions совпадают побайтно. Type-only импорт родителя не создаёт runtime цикла. Единственный caller всегда передаёт item из each filteredItems; передача без item раньше не давала работоспособной строки. Не добавлены новые алгоритмы или тесты механических аннотаций; использованы существующий полный набор и точное compiled comparison.

Backend 1064/25 reused по 565 совпавшим хешам, нового backend run нет. Production c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908 healthy/restarts 0; image/config/env/mounts, 12 соседей, 21 чужой файл и 262 тома сохранены, новых томов и оставшихся тестовых контейнеров 0. Нового браузерного/SMTP/payment/deploy подтверждения нет. Delivery receipt фиксирует commit/push и соответствие accepted source; план 198/244, цель active.

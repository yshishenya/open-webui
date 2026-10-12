# AIRIS — существующие типы малых компонентов

- Type: refactor
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- Created: 2026-10-12

Уточнить boolean|null проверки обновлений, string идентификатора модели, существующий ChatStatus.items и ChatAttachment для файлов изображения. Удалить только неиспользуемые параметры callbacks/индексы. Новых функций, структур исполнения, зависимостей и изменения данных нет.

- [x] Сверить все реальные источники/потребители и сохранить исходные файлы.
- [x] Применить стираемые объявления; проверить идентичность compiled JS/CSS. Исходник нормализовать только удалением доказанно неиспользуемых параметров.
- [x] Пройти полный frontend, scoped/global type/lint/format и сверить сохранность данных; commit/push и план.

Upstream impact:4 малых upstream файла получают только типы/неиспользуемые параметры; fork-owned chat_history.ts уточняет уже существующий ChatStatus. Это тривиальный рефакторинг стираемых аннотаций; отдельный SDD и новые тесты не требуются, проверка использует компилятор и существующий полный набор. Production/A/B открыты.

Доказательства: /Users/yshishenya/.codex/private-artifacts/airis-small-ui-types-20261012.

Сверены Selector.pinModelHandler(string), compareVersion:boolean, backend web_search items(link/title), RichTextInput.files:ChatAttachment[].8compiled JS/CSS сравнений прошли; нормализованы только2 unused catch parameters и2 неиспользуемых индекса циклов. Исполняемый TS и CSS совпали непосредственно.

2532/2532 full; types51→43/24, ESLint183→178, новых0. Scoped5/futureCI367/format clean;8compiled comparisons pass;273 существующие SDD valid. Backend1064/25 reused после565 свежих хешей; production/данные сохранены. PR/CI/выпуск и A/B остаются открытыми.

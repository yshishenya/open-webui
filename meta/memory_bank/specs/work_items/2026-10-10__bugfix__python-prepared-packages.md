# AIRIS — сохранение зависимостей подготовленного Python

## Meta
- Type: bugfix
- Status: completed
- Owner: Codex
- Branch: codex/bugfix/chat-dispatch-replay
- SDD Spec: meta/sdd/specs/completed/airis-python-prepared-packages-2026-10-10-013.json

## Goal
G14: форматирование Python загружает Black вместе с разрешёнными зависимостями из локальных подготовленных файлов. Подготовка не перезаписывает freeze,не изменяет принятые версии и не выдаёт успех при неполных/повреждённых ресурсах.

## Acceptance Criteria
- [x] Ошибка обоих настоящих runtime и перезапись freeze воспроизведены до исправления.
- [x] Общий build/dev/watch путь сохраняет граф micropip;нет ручного списка зависимостей Black.
- [x] Принятые версии сохранены;все подготовленные используемые wheels имеют проверенныйSHA256 и локальноеимя.
- [x] Ошибка download/hash/lock останавливает подготовку,нет ложного успеха.
- [x] Настоящий Black работает в native/sandbox без внешнего PyPI;полные проверки без новых диагностик.
- [x] Исходники/SDD/частные документы отправлены;production/backend/чужие файлы сохранены.

## Root cause and callers
prepare-pyodide.js используется npm dev/build/build:watch/pyodide:fetch и Dockerfile. copyPyodide после micropip.freeze перезаписывает граф;ручное PyPI добавление ставит depends:[] и может продолжить после ошибок. PublicBlack26.10.0 имеет пустойdepends;настоящие native/sandbox дают ModuleNotFoundError click. Официальный micropip0.11.1 freeze сохраняет installedPYODIDE_REQUIRES иполныеversions/sha/URL;loadedPackages включает PyPI. Используется этот механизм,без собственной реализации PEP508.

## Compatibility
Pyodide314.0.3/micropip0.11.1 сохранены;принятые версии prepared lock используются какconstraints. Обновление доlatest314.0.7 — отдельная работа. Официальная версия API прочитана из runtime wheel;сайтдокументации403,version URL404.

## Upstream impact
Изменён только общий scripts/prepare-pyodide.js;потребители runtime,backend иDockerfile не меняются. Зависимостей не добавляется.

## Evidence
/Users/yshishenya/.codex/private-artifacts/airis-python-packages-20261010

## Проверки исходников — 10.10.2026

6 адресных / 1627 общих frontend проверок прошли на 1753 замороженных файлах; types 1321/87 и ESLint 809 без новых диагностик. Настоящие профили Black 26.10.0 (public) и 26.5.1 (repo): по 19/19 браузерных сценариев, по 17 корневых пакетов / 49 зависимостей / 63 файла, проверенные SHA256, сохранённые существующие версии. Повтор подготовки дал побайтово идентичные lock. Trace: 41 локальный запрос, внешних 0; консоль без ошибок и предупреждений. Браузер использует настоящие worker на отдельной локальной странице; полный root/backend путь и production release не проверены. После последнего guard прокси worker не менялись, повторная подготовка сохранила ресурсы; общий прогон повторён. Backend 542 / protected 21 / production и 12 соседей сохранены; 1063 backend проверки переиспользованы. Общие types/lint красные; выпуска нет.

Исходники `028ea3b0e3208c13b3ca3e1c0e5ce1f2fa6798c9` отправлены; 1753 Git blobs совпали. SDD 3/3 закрыта. Частная приёмка синхронизируется отдельно; номерные пункты основного плана сохраняют 198/244. Общие gates, интеграция и production остаются открытыми.

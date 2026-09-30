# Аудит Яндекс Метрики: лендинг и продукт

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: codex/bugfix/metrica-audit-20260930
- SDD Spec: meta/sdd/specs/active/yandex-metrica-production-audit-2026-09-30-001.json
- Created: 2026-09-30
- Updated: 2026-09-30

## Context

Пользователь видит пустую статистику при реальной активности. Аудит охватывает
Tilda-лендинг `airis.you` и продукт `chat.airis.you`, актуальный код `a78b95932`,
опубликованные ресурсы и официальную документацию Яндекса.

## Goal / Acceptance Criteria

- [x] Проверить подключение на обоих опубликованных сайтах по публичным ресурсам.
- [x] Проверить сборку, согласие, просмотры, цели и ecommerce в коде по документации.
- [x] Подготовить минимальное исправление подтверждённых ошибок и регрессионную проверку.
- [x] Сохранить evidence, ограничения проверки и инструкции по настройке.
- [ ] Применить live настройки и подтвердить доставку в кабинет после публикации.

## Findings

- Лендинг работает на Tilda (заголовки `x-tilda-server`, `x-tilda-imprint`), а не
  на Svelte-странице `/welcome`. HTML содержит Tilda stats, но не Метрику или GTM.
- Публичный `https://chat.airis.you/_app/env.js` и файл внутри работающего образа
  содержат пустые `PUBLIC_YANDEX_METRICA_ID` и `PUBLIC_GA_MEASUREMENT_ID`.
  Пустой ID отключает `initializeYandex`; consent не может исправить отсутствие ID.
- `adapter-static` публикует env.js при сборке. Dockerfile и Compose имеют build
  args; GitHub Actions Docker workflow передаёт только BUILD_HASH и variant args.
- `init` без `defer` отправляет автоматический просмотр; затем adapter вызывает
  ручной `hit`. Это даёт дубли первого просмотра и может передать исходный query.
- Исторический work item `2026-08-07__feature__privacy-safe-web-analytics.md`
  содержит запись о созданном счётчике и его целях. Текущий доступ к кабинету
  Яндекса/Tilda не предоставлен; настройки, ID и фактические отчёты требуют
  повторной проверки в кабинете, историческая запись не является live evidence.

## Scope

- Передать публичные measurement IDs из repository variables в Docker build CI.
- Отключить автоматический initial hit (`defer: true`) в общем adapter.
- Сохранить разрешённые campaign query в ручном hit; убрать приватные query/hash.
- Отключить Webvisor и автоматические внешние links в продукте, исключить hash-дубли.
- Добавить тест точного initial hit без query и сохранившегося consent gate.
- Написать руководство по build/runtime, Tilda и проверке настроек/воронки.
- Новых зависимостей и изменений backend/БД нет.

## Upstream impact

- `.github/workflows/docker.yaml`: две строки build args; точка сборки frontend.
- `src/lib/utils/analytics.ts`: одна опция init; общий adapter уже существует.
- Остальные изменения: тест и fork-owned документация.
- `src/lib/components/analytics/AnalyticsBootstrap.svelte`: одна строка dedup key
  для исключения anchor-переходов; это существующий Airis component.

## Verification

- Read-only HTTPS: HTML и headers обоих доменов, product env.js.
- Read-only Docker: image tag, env.js, compiled adapter; без данных пользователей.
- Docker Compose в отдельном project `airis-metrica-audit`: scoped Vitest,
  frontend lint/typecheck; форматирование только затронутых файлов.
- Не отправлять искусственные цели и покупки в production.

### Результаты

- Регрессионный тест до исправления: 1 failed / 6 passed (нет `defer: true`).
- После исправления: 7/7 tests passed в `analytics.test.ts` и `analyticsConsent.test.ts`.
- Scoped ESLint, Prettier для всех изменённых TS/Svelte и `git diff --check`: passed.
- CI YAML parsed через js-yaml; оба measurement build args присутствуют.
- Prettier всего `.github/workflows/docker.yaml`: failed; исходная версия HEAD
  также не проходит. Файл не переформатирован, diff ограничен двумя строками.
- Полный `npm run check`: failed, 8363 errors / 226 warnings в 350 файлах;
  диагностик для изменённых analytics файлов нет. Это не full-green validation.
- Backend/БД не изменены, backend tests не запускались; build/e2e/network delivery
  после применения ID не выполнены, нужна отдельная публикация и live проверка.
- Во время full typecheck обнаружено высокое потребление RAM; дальнейшие тяжёлые
  проверки на хосте с работающим продуктом не запускались. После нагрузки
  `/health` отвечает успешно, Docker health healthy. Деплой вручную не запускался.

## Guide

`meta/memory_bank/guides/yandex_metrica.md`: evidence, build-time ID, Tilda,
общие домены, consent, privacy, цели, ecommerce, ограничения атрибуции и
приоритеты донастройки со ссылками на официальную документацию.

## Limits / Rollout

Production rebuild/deploy и Tilda publish ещё не выполнены. Для завершения live
настройки нужны подтверждённый счётчик, доступ к настройкам Яндекса и Tilda,
repository variable и публикация образа с заполненным ID. Guide фиксирует точный
порядок. Откат: revert patch и пересборка; согласие остаётся обязательным.

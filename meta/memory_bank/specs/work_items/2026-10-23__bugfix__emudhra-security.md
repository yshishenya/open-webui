# [BUG] Обновить зависимости доверенных сертификатов AIRIS

## Meta

- Type: bugfix
- Status: active
- Owner: security-20261023
- Branch: codex/bugfix/emudhra-security-20261023
- SDD Spec: meta/sdd/specs/active/airis-emudhra-security-2026102-2026-10-23-1600.json
- Created: 2026-10-23
- Updated: 2026-10-23

## Context

https://render.com/docs/advisory-emudhra требует certifi>=2026.10.19, Node22>=22.23.4 и штатного обновления системного CA-пакета. Integration c38616a0b; production cdb5f0c8bf, certifi2026.7.22, ca-certificates20250419~deb12u2. Рабочие каталоги других задач не меняются.

## Goal / Acceptance Criteria

- [ ] uv.lock и отдельный accepted CPU production lock содержат certifi>=2026.10.19 с проверенными PyPI URL/SHA256; обновление ограничено этим пакетом.
- [ ] Node build image закреплён на проверенной исправленной версии/digest; системные CA обновлены штатным package manager при чистой сборке.
- [ ] Изолированные tests/image/native/package/resource/migration проверки проходят; совместимость torch2.9.1 trio сохраняется.
- [ ] После разрешённого guarded deploy HTTPX/Requests/aiohttp и default SSL в production отвергают оба advisory endpoints именно с certificate verification error, обычный HTTPS проходит. Сняты версии/образ/digest/health, ключевые функции и соседние сервисы проверены.

## Non-goals

Аналитика не включается; ID/согласия/настройки сохраняются. Запрещены реальные платежи/возвраты и SMTP-тесты третьим лицам. Нет новых AI routes, миграций, DNS/VPN/прав, удаления данных, ручной правки CA или ослабления TLS. LiteLLM/GRAF отдельны.

## Scope

uv.lock, backend/requirements-production.lock, минимальный certifi floor в pyproject.toml, Node build default и существующий пакетный CA install; документация и проверки. API/data model неизменны.

## Upstream impact

Обновлены только security-пины зависимостей/образа; изменение Dockerfile минимально. Новые абстракции и runtime-код не нужны.

## Verification

Bug-fix workflow: подготовка/spec → targeted dependency changes → self-review → существующие Docker Compose backend/frontend checks и image/native checks → draft PR/CI → reviewed integration → clean exact build → disposable migration rehearsal → guarded deploy → runtime readback. Глобальный долг lint отдельно от результатов.

## Risks / Rollback

Guarded deploy требует backup/checksums/migration/health gates. Пользователь разрешил исправления и production; прежняя backup authority не предполагается и устанавливается до любых новых копий. Если применимость не установлена, execute блокируется, независимые исходные проверки продолжаются. Нет новой резервной инфраструктуры. При провале здоровья только штатный откат прежнего образа; данные/схема не откатываются автоматически.

## Completion Checklist

- [ ] SDD check-complete и complete-spec после фактического результата.
- [ ] Branch update с evidence и явными незавершёнными gates.

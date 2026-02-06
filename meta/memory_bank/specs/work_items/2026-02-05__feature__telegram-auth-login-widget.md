# Telegram auth: Login Widget + account linking

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

Нужна авторизация через Telegram (Login Widget) и возможность привязать/отвязать Telegram к существующему аккаунту.
Это снижает трение на входе/регистрации и даёт дополнительный канал аутентификации без пароля.

## Goal / Acceptance Criteria

- [x] Добавить backend endpoints для Telegram Login Widget flow (signin/signup + state/nonce + link/unlink).
- [x] Верифицировать payload Telegram (HMAC), проверять TTL/replay, не логировать секреты.
- [x] Добавить UI: вход через Telegram на странице `/auth` и привязку в настройках аккаунта.
- [x] Добавить тесты для критичной валидации/проверок.
- [x] Задокументировать настройку для оператора.

## Non-goals

- Не меняем существующие способы входа (email/password, OAuth).
- Не добавляем новые зависимости.

## Scope (what changes)

- Backend:
  - `backend/open_webui/routers/auths.py`: Telegram auth endpoints (state/signin/signup/link/unlink) и интеграция в текущий auth router.
  - `backend/open_webui/utils/telegram_auth.py`: HMAC verification, TTL/replay checks, helpers.
  - `backend/open_webui/config.py`, `backend/open_webui/main.py`: безопасная секция `/api/config` + настройка ENV.
  - `backend/open_webui/models/users.py`: хранение/обновление Telegram привязки (если применимо).
- Frontend:
  - `src/routes/auth/+page.svelte`: кнопка/виджет входа через Telegram.
  - `src/lib/components/auth/TelegramLoginWidget.svelte`: UI компонент Login Widget.
  - `src/lib/components/chat/Settings/Account.svelte`: привязка/отвязка Telegram в аккаунте.
  - `src/lib/apis/auths/index.ts`: клиентские методы для Telegram auth.
- Config:
  - `.env.example`, `docker-compose.yaml`: переменные окружения для Telegram auth.
- Docs:
  - `meta/docs/guides/telegram-auth.md`: инструкция по настройке.
- Tests:
  - `backend/open_webui/test/util/test_telegram_auth.py`: unit tests для валидации Telegram payload.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/auths.py`
  - `src/routes/auth/+page.svelte`
  - `src/lib/components/chat/Settings/Account.svelte`
- Why unavoidable:
  - Это существующие entrypoints auth flow и settings UI.
- Minimization strategy:
  - Изменения локализованы; новая логика вынесена в `backend/open_webui/utils/telegram_auth.py` и отдельный UI компонент.

## Verification

- Backend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_telegram_auth.py"`
- Frontend tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
- Note: `npm run check` currently fails due to pre-existing `svelte-check`/typing issues in the repo (not introduced by this work item).

## Task Entry (for branch_updates/current_tasks)

- [x] **[AUTH]** Telegram Login Widget auth + account linking
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__feature__telegram-auth-login-widget.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Add Telegram Login Widget signin/signup plus account link/unlink, with HMAC verification and operator docs.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_telegram_auth.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
  - Risks: Medium (new auth surface; mitigated by HMAC + TTL/replay checks and unit tests).

## Risks / Rollback

- Risks:
  - Неправильная конфигурация ENV может заблокировать Telegram auth flow.
  - Ошибки в callback/verification приводят к невозможности входа через Telegram.
- Rollback plan:
  - Откатить коммиты Telegram auth (backend/router/utils + frontend UI) и удалить ENV секцию из compose при необходимости.

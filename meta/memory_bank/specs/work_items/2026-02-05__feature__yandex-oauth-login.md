# Yandex OAuth login (Russian OAuth providers)

## Meta

- Type: feature
- Status: done
- Owner: Codex
- Branch: airis_b2c
- SDD Spec: `meta/sdd/specs/completed/yandex-oauth-login-2026-02-05-1722.json`
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

В UI уже есть кнопка **“Continue with Yandex”** (страница `/auth`) и env-переменные в `.env.example`
(`YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI`, `YANDEX_OAUTH_SCOPE`), но фактический
backend-flow для `GET /api/v1/oauth/yandex/login` / `GET /api/v1/oauth/yandex/callback` сейчас отсутствует.
В результате Яндекс-авторизация не может быть включена конфигом.

Важно: Open WebUI уже содержит общий OAuth-менеджер на Authlib (`backend/open_webui/utils/oauth.py`) и регистрацию
провайдера Yandex (`backend/open_webui/config.py`), плюс generic endpoint’ы вида `/oauth/{provider}/login`.
Проблема именно в том, что UI/доки ожидают русские URL’ы под `/api/v1/oauth/yandex/*`, которых нет.

Целевой дизайн — **не писать новый OAuth flow**, а:

1) добавить **тонкие API-хуки** под текущие фронтовые URL’ы;  
2) корректно нормализовать Yandex userinfo-поля (`sub/email/name/picture`) для shared OAuth flow.

## Goal / Acceptance Criteria

- [ ] При наличии `YANDEX_CLIENT_ID` + `YANDEX_CLIENT_SECRET` в `/api/config` появляется `oauth.providers.yandex`,
  и кнопка Яндекса отображается на `/auth`.
- [ ] `GET /api/v1/oauth/yandex/login` инициирует OAuth и возвращает redirect на Yandex authorize endpoint.
- [ ] `GET /api/v1/oauth/yandex/callback` завершает OAuth, создаёт/находит пользователя и редиректит на `/auth`,
  где фронтенд подхватывает cookie `token` (не HttpOnly) и пишет его в `localStorage`.
- [ ] Callback URL строго фиксирован: `YANDEX_REDIRECT_URI` **должен** указывать на публичный
  `https://<domain>/api/v1/oauth/yandex/callback` и **в точности** совпадать с Redirect URI в настройках
  приложения в Yandex OAuth (несовпадение → провайдер игнорирует redirect/callback).
- [ ] `user.oauth.yandex.sub` хранит стабильный идентификатор пользователя (claim `id` из Yandex userinfo),
  и сохраняется как строка (`str`).
- [ ] Email берётся из Yandex userinfo корректно (`default_email`, fallback: `emails[0]`), и при отсутствии email:
  - OAuth login не создаёт аккаунт и возвращает user-safe ошибку на `/auth` (без утечки токена/секретов).
- [ ] Поведение флагов:
  - `ENABLE_OAUTH_SIGNUP=false` → не создаём новых пользователей, только логин существующих.
  - `OAUTH_MERGE_ACCOUNTS_BY_EMAIL=true` → допускаем merge по email, иначе возвращаем “email already taken”.

## Non-goals

- Полноценный OIDC logout для Яндекса (не требуется для MVP).
- Изменение модели хранения токена (например, перевод JWT на HttpOnly cookie / серверные сессии).

## Scope (what changes)

- Backend:
  - Добавить endpoint’ы `/api/v1/oauth/yandex/login` и `/api/v1/oauth/yandex/callback` (тонкие обёртки над
    `OAuthManager`).
  - Нормализовать `userinfo` для провайдера `yandex` (email/name/sub).
- Frontend:
  - Не требуется (кнопка и URL уже есть).
- Config/Env:
  - Используем существующие переменные `YANDEX_*`; уточнить в документации, что `YANDEX_REDIRECT_URI` должен
    совпадать с callback URL в настройках приложения Яндекса.
- Data model / migrations:
  - Не требуется (используем существующее поле `users.oauth`).

## Implementation Notes

### Process / Branching

- Перед реализацией создать рабочую ветку по workflow (например, `feature/yandex-oauth-login`) и перенести
  обновления в `meta/memory_bank/branch_updates/<YYYY-MM-DD>-feature-yandex-oauth-login.md` (worktree-safe).

## Proposed Phases / Task Breakdown (SDD-style)

### Phase 1 — API hooks for existing frontend URLs

**Goal:** Make the existing frontend URLs work without duplicating OAuth logic.

- `backend/open_webui/routers/oauth_russian.py`
  - Add `GET /oauth/yandex/login` → delegate to `app.state.oauth_manager.handle_login(..., "yandex")`
  - Add `GET /oauth/yandex/callback` → delegate to `app.state.oauth_manager.handle_callback(..., "yandex", db=...)`
    - Important: provide `db: Session = Depends(get_session)` (same as generic callback in `main.py`)
  - (Opportunistic fix) Correct misleading VK callback log/error strings that mention “Yandex” inside the VK legacy flow.

### Phase 2 — Make shared OAuth callback compatible with Yandex userinfo

**Goal:** Ensure shared OAuth logic can reliably extract `sub/email/name` for `provider == "yandex"`.

- `backend/open_webui/config.py`
  - Add `sub_claim="id"` to `OAUTH_PROVIDERS["yandex"]` config.
- `backend/open_webui/utils/airis/oauth_yandex.py` (new)
  - Implement `normalize_yandex_userinfo(...)` (no secrets; no HTTP; pure transform)
  - Mapping rules (based on Yandex ID docs; see link below):
    - `id` is used as OAuth subject (stored as `str`)
    - `default_email → email` (fallback: first item in `emails[]`)
    - `real_name|display_name|login → name` (first non-empty)
    - `default_avatar_id + !is_avatar_empty → picture` (best-effort):
      - `picture = https://avatars.yandex.net/get-yapic/<default_avatar_id>/islands-200`
- `backend/open_webui/utils/oauth.py`
  - In `OAuthManager.handle_callback`, after `userinfo` is retrieved, call normalization for `provider == "yandex"`.

### Phase 3 — Verification (tests + smoke)

- `backend/open_webui/test/apps/webui/utils/test_oauth_yandex_normalization.py` (new)
  - Unit tests for `normalize_yandex_userinfo(...)` with representative payloads (missing email, missing names, etc).
- `backend/open_webui/test/apps/webui/routers/test_oauth_yandex_router.py` (new)
  - Wiring tests: monkeypatch `app.state.oauth_manager.handle_login/handle_callback` and verify
    `/api/v1/oauth/yandex/login` and `/api/v1/oauth/yandex/callback` delegate with `provider="yandex"`.
- Docs sanity:
  - Ensure `.qoder/RUSSIAN_OAUTH_SETUP.md` and `meta/docs/reference/b2c_implementation.md` remain accurate (no behavior drift).

### Design choice (minimal diff)

Используем уже существующий общий OAuth flow:

- Provider registration: `backend/open_webui/config.py` (Authlib `oauth.register(...)` для `yandex`)
- Core login/callback: `backend/open_webui/utils/oauth.py` (`OAuthManager.handle_login/handle_callback`)

Нужно добавить только:

1) API-хуки под текущие русские URL’ы (`/api/v1/oauth/yandex/*`) в `oauth_russian.py`.
2) Yandex-specific normalization userinfo (т.к. Яндекс возвращает `default_email`, `real_name`, `id`, …, а общий
   flow ожидает `email` и `name` по умолчанию).

### Key files/entrypoints

- Backend router (Russian OAuth): `backend/open_webui/routers/oauth_russian.py`
- OAuth manager: `backend/open_webui/utils/oauth.py`
- OAuth provider config: `backend/open_webui/config.py`
- Frontend login UI: `src/routes/auth/+page.svelte` (кнопка Yandex → `/api/v1/oauth/yandex/login`)

### API changes

Add:

- `GET /api/v1/oauth/yandex/login`
  - Initiates OAuth redirect (Authlib `authorize_redirect`)
- `GET /api/v1/oauth/yandex/callback`
  - Handles callback, sets `token` cookie (not HttpOnly), redirects to `/auth`

### Yandex userinfo normalization

Форма ответа Yandex ID user information API (JSON by default):

- Docs: https://yandex.com/dev/id/doc/en/user-information

Минимальный ответ (без прав/скоупов) содержит только `login`, `id`, `client_id`, `psuid`.
При наличии прав, добавляются `default_email`/`emails`, `real_name`/`display_name`/`first_name`/`last_name`,
и `default_avatar_id`/`is_avatar_empty`.

Пример (объединённый, redacted):

```json
{
  "login": "ivan",
  "id": "1000034426",
  "client_id": "4760187d81bc4b7799476b42b5103713",
  "psuid": "1.AAceCw....",
  "default_email": "test@yandex.ru",
  "emails": ["test@yandex.ru"],
  "real_name": "Ivan Ivanov",
  "display_name": "Ivan",
  "is_avatar_empty": false,
  "default_avatar_id": "131652443"
}
```

Аватар (best-effort) можно скачать по URL-шаблону:

`https://avatars.yandex.net/get-yapic/<default_avatar_id>/islands-200`

Предлагаемый подход:

- В `config.py` для `OAUTH_PROVIDERS["yandex"]` явно выставить `sub_claim="id"`.
- В `OAuthManager.handle_callback(...)` для `provider == "yandex"` прогнать `user_data` через helper, который:
  - нормализует `email` из `default_email` (fallback: `emails[0]`)
  - выставляет `name` из `real_name` → `display_name` → `login` → `email`
  - строит `picture` URL из `default_avatar_id` (если `is_avatar_empty` is false)

Чтобы минимизировать upstream-diff, нормализацию вынести в fork-owned модуль:

- `backend/open_webui/utils/airis/oauth_yandex.py`

### Edge cases

- User denies access (`error=access_denied`): редирект на `/auth?error=...` без создания пользователя.
- Email отсутствует (нет scope `login:email` или пользователь не дал доступ): fail-safe (не создаём пользователя).
- Несовпадение callback URL: должен быть одинаковым в:
  - Yandex app settings
  - `YANDEX_REDIRECT_URI`
  - реальном публичном URL инстанса (reverse proxy / HTTPS).

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/oauth_russian.py` (добавить 2 endpoint’а, тонкие хуки)
  - `backend/open_webui/utils/oauth.py` (минимальная ветка `provider == "yandex"` для normalization)
  - `backend/open_webui/config.py` (добавить `sub_claim` в yandex provider config)
- Why unavoidable:
  - Endpoint’ы `/api/v1/oauth/yandex/*` уже используются во фронтенде и в internal docs.
  - Общий OAuth flow требует корректных claim’ов (`email`, `name`, `sub`) — без normalization авторизация ломается.
- Minimization strategy:
  - Максимум логики в new helper `backend/open_webui/utils/airis/oauth_yandex.py`.
  - В upstream-файлах — только thin hooks + 1 условная ветка для провайдера.

## Verification

Automated checks (passed):

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= -e WEBUI_SECRET_KEY=secret-key airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_oauth_yandex.py open_webui/test/apps/webui/utils/test_oauth_yandex_normalization.py"`

Manual smoke test (pending; required after env+deploy):

1. Set env vars:
   - `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`
   - `YANDEX_REDIRECT_URI=https://<domain>/api/v1/oauth/yandex/callback` (must match Yandex app settings exactly)
2. Open `/auth` → click “Continue with Yandex”
3. Complete Yandex consent → redirected back → user logged in, token appears in `localStorage`.

## Task Entry (for branch_updates/current_tasks)

- [ ] **[AUTH]** Yandex OAuth login
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__feature__yandex-oauth-login.md`
  - Owner: Codex
  - Branch: `feature/yandex-oauth-login`
  - Started: 2026-02-05
  - Summary: Implement `/api/v1/oauth/yandex/*` endpoints + Yandex userinfo normalization for shared OAuth flow.
  - Tests: N/A (spec-only)
  - Risks: OAuth claim mismatches can block login; mitigate with unit tests + manual smoke test.

## Risks / Rollback

- Risks:
  - Shared OAuth flow intentionally sets JWT token cookie as **not HttpOnly** (frontend reads it and stores in
    `localStorage`) — это усиливает последствия XSS. В рамках этого work item поведение не меняем (platform
    constraint), но не добавляем новые инъекционные поверхности в yandex-path.
  - Неверные claim-имена/аватар URL в userinfo → логин не работает.
  - Ошибки в callback URL / reverse proxy → OAuth error на callback.
- Rollback plan:
  - Удалить `/api/v1/oauth/yandex/*` endpoints и yandex normalization ветку, вернуть поведение к текущему состоянию
    (кнопка при этом останется скрытой без `oauth.providers.yandex`).

## Open Questions

- Подтвердить совместимость Authlib `client.userinfo(token=token)` с Yandex ID userinfo endpoint
  (передача access token в Authorization header vs. query params). Если потребуется — добавить compliance fix.
- Уточнить желаемый размер аватара (по умолчанию `islands-200`).

# Prod Yandex OAuth client_id whitespace restart

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/prod-yandex-oauth-whitespace-restart
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

Production Yandex OAuth stopped working. Runtime inspection showed the effective
`YANDEX_CLIENT_ID` inside the `airis` container contained trailing whitespace,
which breaks the generated OAuth authorize URL. The user manually corrected
`/opt/projects/open-webui/.env` on prod and needed a safe restart plus live verification.

## Goal / Acceptance Criteria

- [x] Recreate the prod `airis` container so it reloads the updated `.env`.
- [x] Verify runtime `YANDEX_CLIENT_ID` no longer contains leading/trailing whitespace.
- [x] Verify prod `/health` responds successfully after restart.
- [x] Verify `/api/config` exposes `oauth.providers.yandex`.
- [x] Verify `/api/v1/oauth/yandex/login` returns a redirect to `oauth.yandex.ru`
  with a 32-char `client_id` and the expected callback URI.

## Non-goals

- Rotating Yandex OAuth secrets.
- Changing application code or frontend assets.
- Fixing unrelated Docker build OOM warnings on prod.

## Scope (what changes)

- Backend:
  - No code changes.
- Frontend:
  - No code changes.
- Config/Env:
  - Prod `.env` was corrected manually before the restart.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - Prod runtime env: `/opt/projects/open-webui/.env`
  - Prod service: `airis`
- API changes:
  - None.
- Edge cases:
  - A standard `docker compose up -d --force-recreate airis` attempted a full image
    rebuild and failed on the prod host because `vite build` was killed with `SIGKILL`.
    To avoid leaving prod stale, the running image `yshishenya/yshishenya:edb3b98e3`
    was re-tagged locally as `yshishenya/yshishenya:main`, then the container was
    recreated with `--no-build --no-deps --force-recreate`.

## Upstream impact

- Upstream-owned files touched:
  - None.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - No repo runtime code changes were required.

## Verification

- Prod runtime env check (masked): `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c '... YANDEX_CLIENT_ID/YANDEX_CLIENT_SECRET whitespace report ...'`
- Prod health endpoint: `curl -fsS http://localhost:3000/health`
- Prod Docker health: `docker inspect airis --format "{{json .State.Health}}"`
- Prod config payload: `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c '... http://localhost:8080/api/config ...'`
- Prod login redirect wiring: `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c '... GET /api/v1/oauth/yandex/login ...'`

## Risks / Rollback

- Risks:
  - Low. The running image was reused; only the container environment was reloaded.
- Rollback plan:
  - Recreate `airis` again from the previous env state or restore the previous `.env`
    backup and rerun the same `docker compose up -d --no-build --no-deps --force-recreate airis`.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

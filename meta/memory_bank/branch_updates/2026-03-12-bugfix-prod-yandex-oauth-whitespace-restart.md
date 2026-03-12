# Branch Updates

- [x] **[BUG][AUTH][PROD]** Reload prod Yandex OAuth config after fixing client_id whitespace
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__prod-yandex-oauth-client-id-whitespace-restart.md`
  - Owner: Codex
  - Branch: `bugfix/prod-yandex-oauth-whitespace-restart`
  - Done: 2026-03-12
  - Summary: Recreated the prod `airis` container after manual `.env` correction, confirmed runtime `YANDEX_CLIENT_ID` no longer has trailing whitespace, and verified Yandex OAuth is exposed again in app config and login redirect generation.
  - Tests: prod `docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --no-build --no-deps --force-recreate airis`, prod `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c "... whitespace report ..."`, prod `curl -fsS http://localhost:3000/health`, prod `docker inspect airis --format "{{json .State.Health}}"`, prod `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c "... /api/config ..."`, prod `docker compose -f docker-compose.yaml -f docker-compose.prod.yml exec -T airis python -c "... /api/v1/oauth/yandex/login ..."`
  - Risks: Low (config/runtime-only; no code changes).

# Branch updates — bugfix/rate-card-no-models

- [x] **[BUG]** Rate card page shows no models for provider-only setup
  - Spec: `.memory_bank/specs/work_items/2026-02-03__bugfix__rate-card-no-models.md`
  - Owner: Codex
  - Branch: `bugfix/rate-card-no-models`
  - Done: 2026-02-03
  - Summary: Merge provider base models with workspace overrides; auto-create missing base model records on save.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
  - Risks: Creating base model DB entries on save may affect access-control enforced environments (mitigated: only on explicit admin save).

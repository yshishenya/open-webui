# Restore access control compatibility for model and prompt flows

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `airis_b2c`
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-15
- Updated: 2026-02-15

## Context

Upstream merges introduced a compatibility drift between `access_control`-based API payloads and `access_grants`-based checks in shared helpers, which caused model access checks to deny valid users (HTTP 403) in OpenAI chat/billing paths.

## Goal / Acceptance Criteria

- [x] Restore backward compatibility in `has_access` for `access_control` payloads.
- [x] Keep additive changes to access-check behavior while preserving grant-based logic.
- [x] Ensure legacy prompt/model fields remain backward compatible (`title` vs `name`, command normalization).
- [x] Verify billing scenario tests no longer return 403 for valid users.

## Non-goals

- No changes to public billing pricing logic.
- No dependency or schema changes.

## Scope (what changes)

- Backend:
  - `backend/open_webui/utils/access_control.py`
  - `backend/open_webui/models/models.py`
  - `backend/open_webui/models/prompts.py`
  - `backend/open_webui/routers/prompts.py`
  - `backend/open_webui/routers/users.py`

## Implementation Notes

- Key files/entrypoints:
  - Restored permissive fallback in `has_access` when `access_control` is `None` and strict read access is requested.
  - Reintroduced public-read-compatible handling while maintaining grant checks when explicit grants are provided.
  - Added compatibility handling for prompt title/name and command leading slash.
- Edge cases:
  - Existing clients that pass `access_control` dicts directly.
  - Legacy model prompt names/titles and command routes.

## Upstream impact

- Upstream-owned files touched:
  - `backend/open_webui/routers/openai.py` (indirectly via behavior change in shared `has_access` used there)
- Why unavoidable:
  - Access semantics are shared runtime behavior used by multiple routers and needed for correctness.
- Minimization strategy:
  - Limited to one utility (`has_access`) and minimal model/route compatibility adjustments.

## Verification

- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest open_webui/test/apps/webui/routers/test_openai_chat_billing.py -q"`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py -q"`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest open_webui/test/apps/webui/routers/test_prompts.py open_webui/test/apps/webui/routers/test_users.py -q"`

## Risks / Rollback

- Risks:
  - Shared `has_access` behavior affects other resources if call-sites rely on stricter defaults.
- Rollback:
  - Revert `backend/open_webui/utils/access_control.py` and the small compatibility points in model/prompt routers.

# Lead-magnet model update rejects null access grants

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: codex/bugfix/lead-magnet-access-grants-v011-20260804
- SDD Spec (JSON, required for non-trivial): `meta/sdd/specs/completed/model-mutation-access-grants-2026-08-04-001.json`
- Created: 2026-08-04
- Updated: 2026-08-04

## Context

Enabling the lead-magnet flag for `gpt-5.6-luna` sent a model update containing
`access_grants: null`. The production `ModelForm` annotated this field as a
non-optional list while assigning it a `None` default, so Pydantic rejected the
request before the route ran. The UI reduced the resulting server failure to
“Не удалось обновить прайсинг”.

## Goal / Acceptance Criteria

- [x] A model metadata update accepts an explicit `access_grants: null`.
- [x] A metadata-only update preserves existing access grants.
- [x] Model mutation payloads omit null ACLs while retaining an explicit empty list as “clear ACLs”.
- [x] Other optional list Pydantic fields use an explicit nullable type rather than an incompatible default.
- [x] Regression tests cover the model, prompt, tool, and frontend payload contracts.

## Non-goals

- No changes to LiteLLM routing, provider configuration, model prices, or billing rate-card data.
- No database migration; access grants remain stored in the existing table.

## Scope (what changes)

- Backend:
  - Make optional ACL/tag/list fields explicitly nullable in the production-parity Pydantic schemas.
  - Filter model access grants only when they were supplied, preserving ACLs for metadata-only updates.
  - Add schema regression tests.
- Frontend:
  - Centralize model create/update payload construction and omit null/malformed ACL entries.
  - Preserve the semantic difference between omitted ACLs and an explicit empty list.
- Config/Env:
  - None.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `backend/open_webui/models/models.py` (`ModelForm`)
  - `backend/open_webui/routers/models.py` (`/model/update`)
  - `src/lib/utils/airis/model_payload.ts`
  - `src/lib/apis/models/index.ts`
- API changes:
  - `access_grants` is now an optional nullable field for model mutations; omitted/null values preserve existing ACLs on update.
- Edge cases:
  - Explicit `[]` still clears grants.
  - Null/non-object entries are discarded by the frontend serializer before validation.

## Upstream impact

Upstream-owned backend model/router files and the shared model API helper were
touched because the failure is in the request contract used by the admin UI.
The frontend normalization itself is isolated in `src/lib/utils/airis/` and
the API changes are limited to a shared payload builder and two call sites.

## Verification

- Backend schema regression: `pytest -q open_webui/test/apps/webui/routers/test_model_forms.py` — 2 passed in the production-parity container.
- Frontend payload regression: `npx vitest run src/lib/apis/models/index.test.ts` — 2 passed in the Node 22 container.
- Existing `test_models.py` was attempted but is incompatible with this async production-parity branch’s legacy synchronous test helper (`UsersTable.get_user_by_id` is awaited incorrectly); the failure predates this change.

## Risks / Rollback

- Risks:
  - Callers that intentionally send malformed ACL entries will now have those entries ignored by the frontend serializer.
  - The broad nullable-list cleanup changes validation from an accidental 500 path to the intended nullable contract for related request/response schemas.
- Rollback plan:
  - Revert the bugfix commit; no data migration or irreversible database change was introduced.

## Completion Checklist

- [x] SDD spec linked and completed.
- [x] Branch update entry records implementation, tests, risks, and completion status.
- [x] Production smoke remains pending until the image built from this production-parity branch is deployed.

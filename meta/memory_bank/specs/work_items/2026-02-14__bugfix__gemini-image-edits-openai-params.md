# Fix Gemini image edits behind LiteLLM (strip OpenAI-only params)

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: `codex/bugfix/gemini-image-edits-billing`
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-14
- Updated: 2026-02-14

## Context

When using Gemini image models via LiteLLM (OpenAI-compatible `/v1/images/edits`), Open WebUI was sending
OpenAI-specific parameters (`response_format`, and sometimes `n`/`size`) that trigger provider-side validation
errors. As a result, `Edit Image` failed for Gemini models even though the engine is configured as `openai`.

## Goal / Acceptance Criteria

- [x] `Edit Image` succeeds for Gemini models proxied via LiteLLM (OpenAI-compatible).
- [x] OpenAI-native image models (e.g. `gpt-image-*`) keep working.
- [x] Diff is minimal and localized.

## Non-goals

- Changing pricing/rate cards or billing rules.
- Adding new model mappings in LiteLLM.

## Scope (what changes)

- Backend:
  - Adjust the OpenAI-compatible payload for `/images/edits` to avoid OpenAI-only params for Gemini models.
- Frontend: none
- Config/Env: none
- Data model / migrations: none

## Implementation Notes

- Key files/entrypoints:
  - `/Users/yshishenya/.codex/worktrees/3220/open-webui/backend/open_webui/routers/images.py` (`image_edits`)
- Behavior:
  - Always omit `response_format` for edits.
  - Omit `n` and `size` when the selected model looks like Gemini (`gemini/` or `gemini-` prefix).
  - Keep payload minimal for non-OpenAI models behind OpenAI-compatible gateways.

## Upstream impact

- Upstream-owned files touched:
  - `/Users/yshishenya/.codex/worktrees/3220/open-webui/backend/open_webui/routers/images.py`
- Why unavoidable:
  - The request payload is constructed in the router; the fix must be applied at that callsite.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Small guarded change with an explanatory comment; no refactors/reformatting.

## Verification

- Manual:
  - In admin config: set `Images -> Edit Image` engine to OpenAI-compatible gateway (`https://litellm.pro-4.ru/v1`)
    and model to `gemini/gemini-2.5-flash-image`.
  - Run an edit: ensure it returns an edited image instead of a validation error.
- Automated:
  - Not run in this change (user requested commit + PR only).

## Risks / Rollback

- Risks:
  - Some providers may default to returning `url` instead of `b64_json` when `response_format` is omitted.
    Open WebUI already supports both; risk is low.
- Rollback plan:
  - Revert the commit.


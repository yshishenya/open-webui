- [x] **[BUG][IMAGES]** Fix Gemini image edits behind LiteLLM (strip OpenAI-only params)
  - Spec: `meta/memory_bank/specs/work_items/2026-02-14__bugfix__gemini-image-edits-openai-params.md`
  - Owner: Codex
  - Branch: `codex/bugfix/gemini-image-edits-billing`
  - Done: 2026-02-14
  - Summary: Make `Edit Image` work with Gemini models proxied via LiteLLM by omitting OpenAI-only params.
  - Tests: Not run (user requested commit + PR only).
  - Risks: Low (request payload change; Open WebUI supports both `url` and `b64_json` responses).


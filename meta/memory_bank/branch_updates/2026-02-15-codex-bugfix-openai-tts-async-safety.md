### Done

- [x] **[BUG]** Make OpenAI TTS route async-safe and cache writes atomic
  - Spec: `meta/memory_bank/specs/work_items/2026-02-15__bugfix__openai-tts-async-safety.md`
  - Owner: codex (gpt-5.3-codex)
  - Branch: `codex/bugfix/openai-tts-async-safety`
  - Done: 2026-02-15
  - Summary: Offload blocking HTTP/file work and prevent partial cache files from being treated as hits.
  - Tests: `npm run docker:test:backend`, `npm run billing:confidence:merge-medium`
  - Risks: Low-medium; touches a production router, but change is localized and covered by billing tests.

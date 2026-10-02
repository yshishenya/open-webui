- [x] **[BUG]** Inspect channel editor content for template variables
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__bugfix__channel-input-variables.md`
  - Owner: Codex
  - Branch: `codex/bugfix/channel-input-variables`
  - Done: 2026-10-02
  - Summary: Replace the accidental browser prompt reference with current editor content; type the existing parser.
  - Tests: Two channel failures reproduced; three channel/chat controls passed before the fix. Combined source Docker 171/171 passed, strict4730→4722, warnings217→215, lint1621→1601; zero new diagnostics. PR171 exact-head CI/merge accepted; 12 existing candidate browser cases and 1 real channel editor case passed; frozen/live frontend hashes matched.
  - Risks: Existing editor update/tick boundaries must remain intact; production acceptance separate.

CI initially exposed all19 existing channel lint errors. Remove unused imports/callback arguments/bindings, type existing callbacks and variable maps, remove the unused showFormattingToolbar prop (no caller passes it), and preserve the caller id prop as a data-input-id DOM hook for scoped editor verification. Both callers still supply their unchanged id values. No new dependency/rule suppression; all tick, input and substitution algorithms remain.

Accepted source `e27097f82da6cebc9e170b41139415b16952f068`, merge `a702825db181e4e2f5ef080b906b86d5362dd73c`. Production health and immutable-file/configuration checks passed. Full global strict/lint gates remain open.

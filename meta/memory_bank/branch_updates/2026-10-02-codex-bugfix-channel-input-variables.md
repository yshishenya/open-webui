- [ ] **[BUG]** Inspect channel editor content for template variables
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__bugfix__channel-input-variables.md`
  - Owner: Codex
  - Branch: `codex/bugfix/channel-input-variables`
  - Started: 2026-10-02
  - Summary: Replace the accidental browser prompt reference with current editor content; type the existing parser.
  - Tests: Two channel failures reproduced; three channel/chat controls passed before the fix. Combined source Docker171/171 passed, strict4730→4722, warnings217→215, lint1621→1601; zero new diagnostics. Exact-head CI and merge pending.
  - Risks: Existing editor update/tick boundaries must remain intact; production acceptance separate.

CI initially exposed all19 existing channel lint errors. Remove unused imports/callback arguments/bindings, type existing callbacks and variable maps, remove the unused showFormattingToolbar prop (no caller passes it), and preserve the caller id prop as a data-input-id DOM hook for scoped editor verification. Both callers still supply their unchanged id values. No new dependency/rule suppression; all tick, input and substitution algorithms remain.

# Attachment source resolution

- [ ] **[BUG]** Nullable attachment URLs in chat/channel rendering
  - Spec: meta/memory_bank/specs/work_items/2026-10-04**bugfix**attachment-sources.md
  - Owner: Codex
  - Branch: codex/bugfix/attachment-image-sources
  - Started: 2026-10-04
  - Summary: Trace five actual source expressions, preserve valid media/document behavior and resolve missing addresses once in a fork-owned helper.
  - Tests: Five baseline failures reproduced; seven focused checks and 505 frontend pass; type errors3789→3785, warnings163 and ESLint1416 unchanged. Compiled runtime verification pending.
  - Risks: Channel video/document handling, restored drafts and existing image safety policy must remain intact.

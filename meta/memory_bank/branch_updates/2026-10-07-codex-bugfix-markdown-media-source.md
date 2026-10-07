- [x] **[BUG]** Read sanitized video/audio src in shared Markdown renderer
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__markdown-media-source.md`
  - Owner: Codex
  - Done: 2026-10-07
  - Summary: Accepted compiled baseline lacks a player for VIDEO_FILE_ID in both browsers; fix shared parsing while preserving safe legacy sources and code exclusions.

  - Acceptance: PR321 exact source/merge trees and applicable CI passed; component26/26, frontend770/770, native media8/8/full paths24/24. Guarded production/file/data preservation accepted; global frontend and human/calendar gates remain open.

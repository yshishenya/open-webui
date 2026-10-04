# Attachment source resolution

- [ ] **[BUG]** Nullable attachment URLs in chat/channel rendering
  - Spec: meta/memory_bank/specs/work_items/2026-10-04__bugfix__attachment-sources.md
  - Owner: Codex
  - Branch: codex/bugfix/attachment-image-sources
  - Started: 2026-10-04
  - Summary: Trace five actual source expressions, preserve valid media/document behavior and resolve missing addresses once in a fork-owned helper.
  - Tests: Five baseline failures reproduced; seven focused checks and 505 frontend pass; type errors3789→3785, warnings163 and ESLint1416 unchanged. Compiled runtime verification pending.
  - Risks: Channel video/document handling, restored drafts and existing image safety policy must remain intact.

## Strict CI repair

- Scope expanded after strict changed-file CI found 20 existing lint issues in two consumers. Preserve concrete disabled callback contracts and native swipe/reply/pin controls; add local WebVTT selection with native playback and resource cleanup. Restore the already-supplied shared textarea keyboard callback with two additive lines.
- Focused actual-consumer/caption/keyboard checks: 11/11; scoped ESLint clean. Final full validation and merged compiled runtime remain pending. The overall quality gates and onboarding goal remain open.

- Final expanded checks: 522/522 frontend, 11/11 focused; typecheck3789/163→3763/160, 29 removed, 2 existing signature refinements, 0 new; ESLint1416→1396, 20 removed/0 new. Full project check/lint remain red. SDD valid without warnings. Final compiled rebuild/source CI/production pending.

# Attachment source resolution

- [x] **[BUG]** Nullable attachment URLs in chat/channel rendering
  - Spec: meta/memory_bank/specs/work_items/2026-10-04__bugfix__attachment-sources.md
  - Owner: Codex
  - Branch: codex/bugfix/attachment-image-sources
  - Done: 2026-10-04
  - Summary: Trace five actual source expressions, preserve valid media/document behavior and resolve missing addresses once in a fork-owned helper.
  - Tests: Five baseline failures reproduced; seven focused checks and 505 frontend pass; type errors3789→3785, warnings163 and ESLint1416 unchanged. Compiled runtime verification pending.
  - Risks: Channel video/document handling, restored drafts and existing image safety policy must remain intact.

## Strict CI repair

- Scope expanded after strict changed-file CI found 20 existing lint issues in two consumers. Preserve concrete disabled callback contracts and native swipe/reply/pin controls; add local WebVTT selection with native playback and resource cleanup. Restore the already-supplied shared textarea keyboard callback with two additive lines.
- Focused actual-consumer/caption/keyboard checks: 11/11; scoped ESLint clean. Final full validation and merged compiled runtime remain pending. The overall quality gates and onboarding goal remain open.

- Final expanded checks: 522/522 frontend, 11/11 focused; typecheck3789/163→3763/160, 29 removed, 2 existing signature refinements, 0 new; ESLint1416→1396, 20 removed/0 new. Full project check/lint remain red. SDD valid without warnings. Final compiled rebuild/source CI/production pending.

- Final compiled candidate on executable source2bc78d14380bcaa500f3c0eb746ffd3635b97681:16/16 full paths, restored/saved nullable images, real document/video70.24s, WebVTT10cues/replacement/invalid retention, actual Escape/CtrlEnter and saved-chat remove/save/reload; zero page errors. All executable-source CI gates satisfied. SDD3/3 completed; production and final delivery pending.

- Production accepted: PR257 head48ba6d80ae77901546a51ab3d9c1174f42bbd939/merge13d773c48952a0ea008ab3737e9aa77af689c1a2,10 unique CI success/1 dependency-review skip, identical tree. Digest6c253c7d8e37c632f07e394d1288e7abc1b6314f4590a26358c440c99fd393a8;5777frontend/425Python match;backup20261004T193227Z/migration/rollback/ENV/13neighbors/fullCompose/defaultimage verified,healthy/restarts0. Public saved chat2messages/emptyinput/0consoleerrors/0newsubmissions. Historical pending notes above superseded. Pilot19:38:16UTC:139ordinary/16new7d/0eligible/queue0/DML0/SMTP0;plan192/244/goalactive. Full check/lint remain red3763/160/1396. Next: Controls/common contracts, retaining user parameters and permissions.

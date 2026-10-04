# Attachment source resolution

## Meta

- Type: bugfix
- Status: done — implementation and production acceptance complete; full onboarding goal remains active
- Owner: Codex
- Branch: codex/bugfix/attachment-image-sources
- SDD Spec: meta/sdd/specs/completed/airis-attachment-image-sources-2026-10-04-001.json
- Created: 2026-10-04

## Context and root cause

Chat and channel inputs plus channel messages call startsWith on an optional attachment URL. Restored drafts and desktop query attachments bypass the normal upload producer and can omit that URL. Saved chat view/edit has optional chaining but creates /files/undefined or /files/null. Channel messages compute the URL before inspecting the attachment type, so an ordinary document can also break the whole message.

Normal uploads set url to the uploaded ID and content_type from server metadata. Backend /files/{id} returns JSON metadata; /files/{id}/content serves media under existing authorization. The older explicit-URL contract and data/http passthrough must remain compatible. Unknown descriptors must not mutate user drafts or broaden the Image allowlist.

## Goal / acceptance criteria

- [x] All five actual source expressions handle omitted/null/empty URL without throwing or producing undefined/null paths.
- [x] A known ID without a URL resolves to authorized file content; no address/ID yields an empty string consumed by the existing image placeholder.
- [x] Existing data/http URLs and explicit ID/content_type behavior remain unchanged.
- [x] Strict changed-file ESLint finds zero issues in the affected consumers and new components.
- [x] Native video controls remain; local WebVTT captions can be selected/replaced, invalid input retains the current track, and destruction releases object URLs. No automatic captions are promised.
- [x] The shared textarea forwards real Escape/Ctrl+Enter events to its existing channel editor callback.
- [x] Compiled channel images/documents/video, captions and edit shortcuts pass in the complete application.
- [x] Actual consumer regressions fail on baseline and pass after repair; full frontend tests pass, no new type/lint diagnostics, compiled browser scenarios pass.
- [x] Source CI/merge, candidate and guarded production identity/health/configuration verified; full onboarding goal remains open.

## Scope and upstream impact

One small fork-owned resolver in src/lib/utils/airis with thin calls in chat/MessageInput, chat/Messages/UserMessage, channel/MessageInput and channel/Messages/Message. Replace all five duplicate expressions and use exact native equality for the optional modal type. Retain existing Image safety policy, uploads, draft storage, file preview, API, database and dependencies. No broad component formatting. Strict PR CI additionally exposed 20 existing lint issues in the touched channel/user message components. Remove unused imports/state, type callback contracts including disabled=false, and retain swipe/reply/pin controls. A fork-owned AttachmentVideo keeps native playback and accepts local WebVTT files up to 5 MiB using async reading and revision/object-URL cleanup. A key on the source remounts video when attachment identity changes. Two additive lines in shared common/Textarea restore the already-supplied keyboard callback; no new dependencies or app services.

## Verification / rollback

Use Compose-created frontend tools for actual expression regressions, full Vitest, check and lint; compare against baseline 3789 errors/163 warnings/1416 ESLint. Browser checks use the compiled candidate and existing real backend fixture. Guarded release preserves the environment, neighbors and recovery point with the existing disk limit. Roll back to the current accepted image if runtime acceptance fails. Controlled checks do not establish a real pilot, money, external delivery or answer usefulness.

## Source verification

Baseline source: 3a9811fed022b4545fa76e054f5a77cf836d6927. Merged integration PR255 adds 13 frontend tests with no type/lint delta. The original source-only verification below is superseded by the final expanded validation when recorded.

Five actual consumer cases fail before the repair; all seven targeted checks and 505/505 frontend tests in 76 files pass after it. Check3789→3785 errors, warnings163 unchanged: four removed, zero new or refined diagnostics. ESLint1416 unchanged; new helper/test scoped lint passes. Overall quality gates remain red. Compiled candidate, exact-source CI and production acceptance remain pending.

## Final expanded source checks

- 522/522 frontend tests, 78 files; focused resolver/caption/actual-keyboard checks 11/11; strict changed-file ESLint clean.
- Typecheck: 3789 errors/163 warnings → 3763/160. Complete mapped comparison removes 29 diagnostics; two existing diagnostics only refine printed prop signatures (onInsertToNote and aria-label). Zero new diagnostics.
- ESLint: 1416 → 1396, 20 removed and zero new. Overall project type/lint remain failing; they are not reported as green.
- SDD validation: zero errors/warnings. Final compiled rebuild, source CI and production acceptance pending.

## Final compiled acceptance

Executable source: 2bc78d14380bcaa500f3c0eb746ffd3635b97681. Final linux/amd64 local candidate: sha256:ab448ed63b7a006c53bee3f9f4b7b4c643550348710c30bf6e0136de4711dc00. The unchanged 425 backend files, inherited base layers/image environment and accepted dynamic env.js were compared by hashes. Final frontend includes integration PR255.

- 16/16 full-path scenarios pass in Chromium and Firefox390px, including three free tasks, provider errors and controlled checkout/credit/history/service-mail replay. External protocols are fixture-controlled.
- Restored draft keeps all three descriptors and its text; ID-only/null image loads authorized /content with naturalWidth1. Saved-chat view and edit show that image plus two existing favicon placeholders (width500); removal/save/reload preserves the remaining descriptors and null URL.
- A real local channel shows the image, document and native video controls; video duration70.24s and playback progress verified. Real guide VTT yields10 cues in showing mode; replacement yields1 correct cue; invalid file retains the current track and displays a safe error.
- Real editor Escape cancels without changing the message; Ctrl+Enter saves and reload/API confirm the stored text. Zero page errors in acceptance.
- Exact executable source CI: all required checks succeed, dependency review is skipped by policy. Implementation SDD3/3 is complete; production release remains pending and is a separate gate.

## Production acceptance — 2026-10-04

PR257 head48ba6d80ae77901546a51ab3d9c1174f42bbd939 passed all 10 unique CI checks; dependency review skipped, CodeRabbit review disabled for this base. Merge13d773c48952a0ea008ab3737e9aa77af689c1a2 has the identical full tree. The head differs from executable source2bc78d14380bcaa500f3c0eb746ffd3635b97681 only in documentation.

Released yshishenya/yshishenya:attachment-sources-2bc78d143-20261004, digest sha256:6c253c7d8e37c632f07e394d1288e7abc1b6314f4590a26358c440c99fd393a8. Registry and runtime match all5777 frontend/425 Python files, inherited layers/environment and dynamic analytics settings. Verified backup20261004T193227Z, hard migration gate, retained rollback image and full three-file Compose. Runtime healthy/restarts0, existing environment and all13 neighbors preserved;10.60GiB free. Only the image default was persisted atomically after acceptance.

Public health/version/env match the accepted candidate. Reloaded ordinary-user saved chat shows its2 existing messages and empty input;0 console errors,0 submitted messages/payments. Nullable image/channel video/caption/edit acceptance is on the identical compiled candidate; production channels were not enabled for testing. These observations supersede the historical pending release notes above.

Read-only pilot inventory19:38:16UTC:139 ordinary accounts,16 new within7d,0 eligible permissions;126 no_consent/13 inactive,queue0/DML0/SMTP0. Plan remains192/244. Full-project typecheck3763errors/160warnings and ESLint1396 remain red; real delivery, payments/receipt, phone, usefulness and calendar pilot gates remain open.

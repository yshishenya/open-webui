# Release voice-call microphone resources without losing complete phrases

- Type: bugfix
- Status: In Progress
- Owner: Codex
- Branch: codex/bugfix/call-audio-lifetime
- SDD Spec: meta/sdd/specs/active/airis-call-audio-lifetime-2026-10-07-001.json
- Created: 2026-10-07

## Reproduction and scope

Actual CallOverlay start/stop handlers leave one live microphone track, construct one recorder and start analysis after close while permission is pending. Both mobile Drawer and desktop controls mount this component. A segment starts before the previous transcription finishes; recording generation must not cancel valid previous phrases. Async onMount cleanup is ignored, teardown waits before stopping tracks, and AudioContext/wake lock have no release owner.

## Measurable acceptance

- [x] Close/unmount stops every owned audio track synchronously; late permission leaves zero tracks/recorders/analysis.
- [x] Constructor/start/analyser/permission failures release resources and permit retry; zero unhandled errors.
- [x] Old callbacks and animation frames cannot clear or operate on the next recorder.
- [x] Final native bytes, their MIME type and normal successive phrase transcription survive; exactly one submit per completed phrase.
- [x] Mute drops partial recording; close drops late transcription and causes zero late submits/toasts.
- [x] AudioContext, wake lock and registered listeners are released on teardown, including late wake permission.
- [ ] Full frontend tests pass; normalized new type/lint diagnostics zero; exact-source CI and both compiled browsers pass.
- [ ] Protected production identity/assets/health/backup match; money/config/data/rollback are preserved.

## Implementation and upstream impact

Minimal change in the existing CallOverlay shared owner using native MediaRecorder, MediaStream, AudioContext and Svelte lifecycle. Local recorder/chunks plus recording and call generations; no helper class, dependency, backend, provider or schema change. Capture terminal bytes before the next segment. Preserve camera and TTS contracts. Native-event doubles prove browser/component lifetime, not real physical device acceptance. Existing >500-line upstream component is retained to avoid unrelated upstream conflicts.

## Verification and rollback

Before/after actual-handler regression; Docker Compose-first frontend/types/lint; compiled Chromium and Firefox390px; exact source CI. Current global baseline:2962 type errors/113warnings,1110 ESLint errors. Those gates remain open until full zero. Retain current backend/ENV, verified backups and previous immutable image; protected deployment includes migration/health/config/money guards.

Private evidence: airis-call-audio-lifetime-20261007. Overall plan198/244,46open,goal active; this prerequisite does not close human/mail/payment/calendar/global-quality gates.

## Source acceptance

13 actual-handler cases pass; full frontend921/921 in111files, with no unhandled errors. Initial before regression:10failed/1passed in11cases. Both callback ordering and late STT result/error are verified only after the actual STT call enters. Types2942errors/113warnings versus2962/113; full lint1110errors unchanged; normalized new diagnostics0. Touched source/test/e2e lint and format pass. No preflight script is declared; explicit Docker source checks substitute, existing global debt is retained as a failing gate. Compiled browsers, CI and production remain pending.

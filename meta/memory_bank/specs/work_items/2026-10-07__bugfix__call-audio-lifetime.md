# Release voice-call microphone resources without losing complete phrases

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/call-audio-lifetime
- SDD Spec: meta/sdd/specs/completed/airis-call-audio-lifetime-2026-10-07-001.json
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
- [x] Full frontend tests pass; normalized new type/lint diagnostics zero; exact-source CI and both compiled browsers pass.
- [x] Protected production identity/assets/health/backup match; money/config/data/rollback are preserved.

## Implementation and upstream impact

Minimal change in the existing CallOverlay shared owner using native MediaRecorder, MediaStream, AudioContext and Svelte lifecycle. Local recorder/chunks plus recording and call generations; no helper class, dependency, backend, provider or schema change. Capture terminal bytes before the next segment. Preserve camera and TTS contracts. Native-event doubles prove browser/component lifetime, not real physical device acceptance. Existing >500-line upstream component is retained to avoid unrelated upstream conflicts.

## Verification and rollback

Before/after actual-handler regression; Docker Compose-first frontend/types/lint; compiled Chromium and Firefox390px; exact source CI. Current global baseline:2962 type errors/113warnings,1110 ESLint errors. Those gates remain open until full zero. Retain current backend/ENV, verified backups and previous immutable image; protected deployment includes migration/health/config/money guards.

Private evidence: airis-call-audio-lifetime-20261007. Overall plan198/244,46open,goal active; this prerequisite does not close human/mail/payment/calendar/global-quality gates.

## Source acceptance

13 actual-handler cases pass; full frontend921/921 in111files, with no unhandled errors. Initial before regression:10failed/1passed in11cases. Both callback ordering and late STT result/error are verified only after the actual STT call enters. Types2942errors/113warnings versus2962/113; full lint1110errors unchanged; normalized new diagnostics0. Touched source/test/e2e lint and format pass. No preflight script is declared; explicit Docker source checks substitute, existing global debt is retained as a failing gate. Chromium 38/38 and Firefox at 390px 38/38 pass; applicable exact-source CI and protected production accepted.

## Production acceptance

Source b34184a147cc344d95336cd01923aebdc253dc91, integration merge bbd6d52af67184664684cb5eb1d963681742f6ff (trees identical). PR355 merged after GitHub HTTP500 recovered; standard Git integration push used. Registry/server digest sha256:e859eebe7922c165ba7fb249316961a6ab5319ac99a23780d732f45f42b29ff9, release 20261007T151839Z-call-audio-b34184a147-20261007. Full current CI inventory: 13 checks, applicable success; dependency review skipped and CodeRabbit disabled. Public compiled call asset verified by SHA256; production removes console.error strings, so acceptance uses the actual call module instead of a removed logging marker.

Production healthy, restarts zero, 4915 frontend/427 Python files match. Packaged backend preserves all 496 files; live backend matches 495 and the existing startup copy replaces static/site.webmanifest with the exact accepted frontend static file (verified). Runtime ENV, mounts, 12 neighbors and money unchanged, audit DML zero. Verified 11-file backup and previous voice backup/rollback retained. Image pinned without a second container recreate. After backup free space exceeds 10 GiB. Two archived old backups have 22/22 SHA256 and size matches on Mac. Physical media, global quality and human/mail/payment/calendar gates remain open; plan 198/244 unchanged.

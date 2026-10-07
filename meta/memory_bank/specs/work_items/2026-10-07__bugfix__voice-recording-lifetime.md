# Preserve voice recording while releasing owned media resources

## Meta

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: codex/bugfix/voice-recording-lifetime
- SDD Spec: meta/sdd/specs/completed/airis-voice-recording-lifetime-2026-10-07-001.json
- Created: 2026-10-07

## Context and final result

VoiceRecording starts shared microphone/screen-audio resources in four callers: chat (keeps the component mounted while hidden), channel, notes and knowledge text modal (can unmount). Recorder construction is outside the acquisition catch; unmount does not release the stream. Native permission/start/wake-lock and stop/dataavailable events can finish after cancel/unmount. Current shared audioChunks cleanup can race final dataavailable, so ownership and content must be verified together. This fixes a confirmed privacy/content prerequisite of the existing quality gate.

## Measurable acceptance

- [x] Denied acquisition, recorder construction/start and analyser failure leave zero live owned tracks and reset loading/recording; retry works.
- [x] Cancel/unmount synchronously stop owned tracks; late acquisition/start/wake lock cannot restart recording, timer or analysis.
- [x] Obsolete callbacks cannot stop, clear or confirm a newer session.
- [x] Native final dataavailable is included: confirmed Blob bytes match all recorded chunks exactly, one confirmation per session.
- [x] Cancel/unmount causes zero confirmations or late transcript insertions; confirmed active recording still reaches its caller.
- [x] Screen video tracks stop immediately, extracted audio remains until explicit stop; web recognition cancellation/confirmation retained.
- [x] Timer, recognition timeout, AudioContext and wake lock have one owner and are released without clearing a newer owner.
- [x] Before/after actual-handler regression, full frontend, zero new diagnostics, exact-source CI and compiled Chromium/Firefox pass.
- [x] Protected production release matches candidate and preserves money/config/data/rollback; real-device and global conditions remain separately open.

## Implementation and upstream impact

Reuse VoiceRecording start/stop/cancel/confirm functions and existing native APIs. Keep ownership in this upstream component with a request generation and destruction fence; session-local recorder/chunks survive asynchronous stop. Keep caller contracts and initial permission streams, which all callers already stop. No new dependency, schema or provider. CallOverlay audio is a separate owner and will not be claimed accepted by this component fix.

## Verification and rollback

Existing Svelte parser/TypeScript/Vitest handler extraction, disposable native event doubles and compiled browser UI. Consult official native stop/dataavailable/wake-lock/AudioContext documentation. Docker Compose-first checks against current accepted camera source; preserve global baseline2990typeerrors/114warnings and1116ESLinterrors until separately fixed. Frozen source, CI, candidate and production proofs remain distinct. Retain backend and use protected backup/migration/health/image/config guards.

Private evidence: airis-voice-recording-lifetime-20261007. Plan198/244 unchanged, goal active; no physical devices or independent human/mail/payment/calendar acceptance implied.

## Source checks

15 actual-handler regressions pass, including both web-recognition/native stop orderings and confirmation while wake permission is pending. All908 frontend tests in110files pass. Full types2962errors/113warnings versus2990/114 baseline: normalized new diagnostics0. Scoped lint/format pass; prior full lint1110errors versus1116baseline,new0. Global source quality remains open. File-mode confirmation adds `text:''` while retaining identicalFile/Blob for notes; all4callers traced. Cancel button has the existing translated accessible name. Native-event browser doubles are synthetic,never hardware. Compiled browser and protected production acceptance are pending.

## Accepted release

PR353 source `0380e652ddb149cf0850736c4b94bd44293137d5`, merge `6b66b019b4805f1540b39173683dd4944eaa8edc`; trees equal. All applicable CI checks passed for this exact source. Dependency review was skipped; CodeRabbit review is disabled. Frozen candidate: Chromium 37/37 and Firefox at 390px 37/37, totalling 74 passes with zero failures/errors/skips. The two setup executions are excluded. Additional private permission-denial/retry checks passed for microphone and screen: two selected tests; 15 unrelated cases were excluded by the test-name filter. Native streams/events are synthetic; hardware remains unverified. All 6554 frozen public source files are unchanged. Two published compiled recording assets match candidate hashes.

Production digest `sha256:3c05baa40669b588bbb78b669dfedcdab2d8af1c3e69a6d76c1ad7833e8a36cd`, release `20261007T140257Z-voice-recording-0380e652dd-20261007`. All 4915 frontend files and 427 Python backend files match; the full 496-file backend was preserved. Docker is healthy with zero restarts. Money, runtime environment, data mount and 12 neighboring containers are unchanged. The image was pinned without recreating the container. The new backup contains 11 verified files; the previous backup and rollback image remain available. Free space after release exceeds 10 GiB. Public health/version/env/guide return 200; Metrica 111392024 remains configured.

The old terminal-pane backup from 05.10 was moved to Mac: every file matches by SHA256 and size, and the archive/dump are readable. Only that exact server copy was removed; current camera/screen backups remain. A temporary rsync binary was extracted under the operator cache for delta transfer, then removed. System packages were unchanged. Only three owned test services and their empty network were removed. All 77 other local containers, images and semantic mounts, plus 21 unrelated tracked files, were preserved. Six mount lists differed only in ordering.

SDD is complete at 3/3. Global quality remains open: 2962 type errors, 113 warnings and 1110 ESLint errors; normalized new diagnostics: zero. The main plan remains 198/244 with 46 open items and zero numbered closures in this prerequisite; the overall goal remains active. A separate actual-handler probe reproduces a late-permission microphone leak in CallOverlay after ending a call. This release does not change CallOverlay audio. Physical devices, inbox/replies/two operators, independent usefulness, voluntary pilot, payment and real 24h/72h/14d windows/mature cohorts remain open.

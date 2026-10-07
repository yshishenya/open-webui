# Preserve voice recording while releasing owned media resources

## Meta

- Type: bugfix
- Status: In Progress
- Owner: Codex
- Branch: codex/bugfix/voice-recording-lifetime
- SDD Spec: meta/sdd/specs/active/airis-voice-recording-lifetime-2026-10-07-001.json
- Created: 2026-10-07

## Context and final result

VoiceRecording starts shared microphone/screen-audio resources in four callers: chat (keeps the component mounted while hidden), channel, notes and knowledge text modal (can unmount). Recorder construction is outside the acquisition catch; unmount does not release the stream. Native permission/start/wake-lock and stop/dataavailable events can finish after cancel/unmount. Current shared audioChunks cleanup can race final dataavailable, so ownership and content must be verified together. This fixes a confirmed privacy/content prerequisite of the existing quality gate.

## Measurable acceptance

- [ ] Denied acquisition, recorder construction/start and analyser failure leave zero live owned tracks and reset loading/recording; retry works.
- [ ] Cancel/unmount synchronously stop owned tracks; late acquisition/start/wake lock cannot restart recording, timer or analysis.
- [ ] Obsolete callbacks cannot stop, clear or confirm a newer session.
- [ ] Native final dataavailable is included: confirmed Blob bytes match all recorded chunks exactly, one confirmation per session.
- [ ] Cancel/unmount causes zero confirmations or late transcript insertions; confirmed active recording still reaches its caller.
- [ ] Screen video tracks stop immediately, extracted audio remains until explicit stop; web recognition cancellation/confirmation retained.
- [ ] Timer, recognition timeout, AudioContext and wake lock have one owner and are released without clearing a newer owner.
- [ ] Before/after actual-handler regression, full frontend, zero new diagnostics, exact-source CI and compiled Chromium/Firefox pass.
- [ ] Protected production release matches candidate and preserves money/config/data/rollback; real-device and global conditions remain separately open.

## Implementation and upstream impact

Reuse VoiceRecording start/stop/cancel/confirm functions and existing native APIs. Keep ownership in this upstream component with a request generation and destruction fence; session-local recorder/chunks survive asynchronous stop. Keep caller contracts and initial permission streams, which all callers already stop. No new dependency, schema or provider. CallOverlay audio is a separate owner and will not be claimed accepted by this component fix.

## Verification and rollback

Existing Svelte parser/TypeScript/Vitest handler extraction, disposable native event doubles and compiled browser UI. Consult official native stop/dataavailable/wake-lock/AudioContext documentation. Docker Compose-first checks against current accepted camera source; preserve global baseline2990typeerrors/114warnings and1116ESLinterrors until separately fixed. Frozen source, CI, candidate and production proofs remain distinct. Retain backend and use protected backup/migration/health/image/config guards.

Private evidence: airis-voice-recording-lifetime-20261007. Plan198/244 unchanged, goal active; no physical devices or independent human/mail/payment/calendar acceptance implied.

## Source checks

15 actual-handler regressions pass, including both web-recognition/native stop orderings and confirmation while wake permission is pending. All908 frontend tests in110files pass. Full types2962errors/113warnings versus2990/114 baseline: normalized new diagnostics0. Scoped lint/format pass; prior full lint1110errors versus1116baseline,new0. Global source quality remains open. File-mode confirmation adds `text:''` while retaining identicalFile/Blob for notes; all4callers traced. Cancel button has the existing translated accessible name. Native-event browser doubles are synthetic,never hardware. Compiled browser and protected production acceptance are pending.

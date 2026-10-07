# Release screen capture resources on every outcome

## Meta

- Type: bugfix
- Status: active
- Owner: Codex
- Branch: `codex/bugfix/screen-capture-cleanup`
- SDD Spec: `meta/sdd/specs/active/airis-screen-capture-cleanup-2026-10-07-001.json`
- Created: 2026-10-07

## Context

MessageInput's screenCaptureHandler acquires a display stream but stops its tracks only after successful drawImage. Actual-handler reproduction proves two live tracks and attached video after play failure, missing 2d context and draw failure. The input attachment menu calls this same handler on desktop; mobile uses its native camera input. This affects resource ownership in the shared chat input and prevents acceptance of the cleanup quality gate.

## Goal / Acceptance Criteria

- [ ] Every acquired track stops exactly once and video srcObject becomes null on play/context/draw failure and success.
- [ ] Cleanup happens before image conversion, fetch or attachment handoff; downstream failure cannot extend capture.
- [ ] Denied capture performs no conversion/upload; successful capture creates exactly one PNG attachment.
- [ ] Native cursor=never/audio=false request and existing file workflow preserved; no real capture invoked by automated tests.
- [ ] One permanent actual-handler regression fails on original source and passes on fix; full frontend tests pass; zero new type/lint diagnostics.
- [ ] Compiled candidate passes mandatory browser paths; source/CI/image/production proofs recorded separately.

## Scope / Implementation

Use the native stream and video APIs and a local try/finally around frame acquisition. Guard null canvas context. Reuse existing Svelte parser/TypeScript/Vitest actual-handler test pattern. No new dependencies, routes, media subsystem or schema changes.

Related CallOverlay and VoiceRecording handlers were inspected: they own separate long-lived camera/recording streams and will require their own reproduction and lifetime criteria. Their behavior is not changed or claimed accepted by this one-shot capture correction.

## Upstream impact

Only the screenCaptureHandler block in upstream-owned MessageInput.svelte changes; it owns the local stream and has no extension point for cleanup. Keep the remaining component formatting and behavior intact. Add a fork-owned regression under src/lib/utils/airis.

## Verification

Docker Compose-first: focused regression before/after, full frontend suite, scoped lint/format, full type/lint comparison, compiled mandatory browser paths against disposable databases. MDN MediaStreamTrack.stop, getDisplayMedia and canvas.getContext documentation consulted; installed Svelte/TypeScript reused without version changes. Evidence: private airis-screen-capture-cleanup-20261007 directory.

## Risks / Rollback

Cleanup moves earlier, immediately after the frame is copied into the canvas. PNG conversion and file handoff must remain unchanged. Roll back this source/image if required. Plan remains198/244; no independent-human/calendar/payment criteria are closed by technical checks.

## Source verification — 2026-10-07

Actual-handler regression: original7failed/1passed, fixed8/8passed. Full frontend891/891,108files. Check3004→3002errors/118warnings; fullESLint1127unchanged; zero new diagnostics. Scoped lint0 after declaring the native MediaTrackConstraints ambient type as readonly; no rules weakened. Compiled browser scenario added for real menu invocation with disposable media doubles; no real device/permission accessed. Source/CI/compiled/production acceptance remain separate, SDDactive. No business criteria closed.

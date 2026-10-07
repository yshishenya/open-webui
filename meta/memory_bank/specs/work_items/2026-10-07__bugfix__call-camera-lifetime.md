# Release call camera resources on failure and cancellation

## Meta

- Type: bugfix
- Status: In Progress
- Owner: Codex
- Branch: `codex/bugfix/call-camera-lifetime`
- SDD Spec: `meta/sdd/specs/active/airis-call-camera-lifetime-2026-10-07-001.json`
- Created: 2026-10-07

## Context and final result

CallOverlay acquires a camera/display stream, then enumeration or play can reject without stopping tracks. The camera button also acquires a separate permission stream and discards it. Stopping or destroying the overlay while native permission is pending can allow a late stream to become active again. Both initial camera and device-switch paths must use the same stream owner. This is a prerequisite for the existing global quality gate, not a new product feature.

## Measurable acceptance

- [ ] Zero live video tracks and detached video after enumeration/play failure, camera off, end call or component destruction.
- [ ] A late acquisition after stop/destruction is stopped; no video is attached and no further play is attempted.
- [ ] An obsolete request cannot overwrite or stop a newer stream, even if old acquisition/enumeration/play finishes last.
- [ ] Denial and initial enumeration failure are handled in both callers; no unhandled promise and camera can be retried.
- [ ] Camera button invokes one owned acquisition, preserving saved-device selection; no discarded permission stream.
- [ ] Successful camera/screen preview stays live until explicit stop; screen cursor/audio settings and screenshot flow preserved.
- [ ] Permanent actual-handler regression fails before and passes after; full frontend suite passes and zero new lint/type diagnostics.
- [ ] Exact-source CI, compiled browser checks and protected production acceptance recorded separately.

## Implementation and upstream impact

Reuse stopVideoStream and stopCamera in upstream-owned CallOverlay.svelte. Add only a request generation and synchronous destruction fence, clean failures in shared startVideoStream, and detach the video at stop. Remove the redundant acquisition in the button. No new dependency, runtime module, schema, provider or recording rewrite. VoiceRecording has a separate confirmed constructor/unmount defect and remains the next scoped task; this work does not claim microphone acceptance.

## Verification and rollback

Existing Svelte parser/TypeScript/Vitest actual-handler pattern, Docker Compose focused/full frontend tests, scoped formatting/lint, full diagnostic comparison and compiled Chromium/Firefox checks using disposable native API doubles. Platform behavior checked against current MDN getUserMedia/getDisplayMedia/play/track.stop documentation. Real device permissions are not requested by automation. Preserve current production backend and money/config/mounts, use protected backup/migration/health/image gates. Retain previous image for rollback. Global quality and human/calendar/payment criteria stay open until their own evidence exists.

Private evidence directory: `airis-call-camera-lifetime-20261007`. Source base is current integration `a49ebfb1068f28fdad6f245572b892b530c53738`; production before work is healthy at runtime source `3bcb2af94c3cd6d73c66d74350da6a1f26932301`, restarts0. Existing plan remains198/244.

## Source verification — 2026-10-07

Both camera/screen actual-handler regressions failed on original source and pass after correction. Cases include enumeration/play/denial, cancellation while acquisition/enumeration/play is pending, and obsolete acquire/enumerate/play/rejection after a newer successful stream. Full frontend893/893,109files. Check3002→2993errors,118warnings; fullESLint1127unchanged; zero new diagnostics. Scoped new test/config lint0, CallOverlay retains11 pre-existing lint errors. Formatting passes. Compiled/production acceptance pending. No new dependencies. GlobalqualityG14/13.11/13.16 and numberedplan198/244 remain unchanged.


## CI repair and packaging recovery — 2026-10-07

Touched-component CI identified11 historical lint errors. Removed unused declarations, typed callback/event signatures against existing ChatControls contracts, typed the existing finish-message dictionary, corrected non-void tags and muted the video-only preview. No suppression, rule relaxation, dependency or broad formatting change. Final scopedlint0 and formatting pass; actual-handler2/2; fullfrontend893/893. Types3002→2990errors,118→114warnings, fullESLint1127→1116; zero new diagnostic identities. Fixed the compiled regression to open Voice mode on an empty composer, before filling a draft.

Current production has127layers and the first overlay build hit max depth exceeded. The candidate uses the earlier85layer image with identical backend496files and non-label image config, whose layers are a prefix of current production. All56 intervening history instructions only affect frontend and labels. Restore current frontend static files, ENV and every current label; rebuild the current application from the exact accepted source. Preserve backend and verify complete manifests. Compiled/CI/production acceptance remains pending.

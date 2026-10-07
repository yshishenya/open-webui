# Release screen capture resources on every outcome

## Meta

- Type: bugfix
- Status: Done
- Owner: Codex
- Branch: `codex/bugfix/screen-capture-cleanup`
- SDD Spec: `meta/sdd/specs/completed/airis-screen-capture-cleanup-2026-10-07-001.json`
- Created: 2026-10-07

## Context

MessageInput's screenCaptureHandler acquires a display stream but stops its tracks only after successful drawImage. Actual-handler reproduction proves two live tracks and attached video after play failure, missing 2d context and draw failure. The input attachment menu calls this same handler on desktop; mobile uses its native camera input. This affects resource ownership in the shared chat input and prevents acceptance of the cleanup quality gate.

## Goal / Acceptance Criteria

- [x] Every acquired track stops exactly once and video srcObject becomes null on play/context/draw failure and success.
- [x] Cleanup happens before image conversion, fetch or attachment handoff; downstream failure cannot extend capture.
- [x] Denied capture performs no conversion/upload; successful capture creates exactly one PNG attachment.
- [x] Native cursor=never/audio=false request and existing file workflow preserved; no real capture invoked by automated tests.
- [x] One permanent actual-handler regression fails on original source and passes on fix; full frontend tests pass; zero new type/lint diagnostics.
- [x] Compiled candidate passes mandatory browser paths; source/CI/image/production proofs recorded separately.

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

## Final acceptance — 2026-10-07

PR349: https://github.com/yshishenya/open-webui/pull/349. Accepted source `3bcb2af94c3cd6d73c66d74350da6a1f26932301`, merge `01c69d4e23a6c84820843636af8e402f84ed157d`; trees equal. Exact-source CI passed, including billing-confidence; dependency-review skipped and CodeRabbit review skipped. Source frontend891/891,108files; actual capture regression before7failed/1passed, after8/8passed. Check3004→3002errors/118warnings, fullESLint1127unchanged, zero new diagnostics and scoped lint0. GlobalqualityG14/13.11/13.16 remains open.

Compiled candidate: Chromium34/34 and Firefox390px34/34, total68, no failures/errors/skips; 2globalSetup excluded. The real Capture menu failure scenario uses disposable native media doubles: both tracks stop, video detaches, draft remains usable; no real screen/device permission requested. All6542 originalsourcehashes preserved;4915frontend/496rawbackend accepted. Related CallOverlay and VoiceRecording lifetime defects are separately reproduced and not fixed by this release.

Production release `20261007T120403Z-screen-capture-3bcb2af94c-20261007` accepted, digest `sha256:5e5c6f0ccef95f5b7184c63d1b99a1e11b218802068a3a031ac49fc50ff5cd95`. Live4915frontend/427Pythonhashes match the candidate; backend6a2b5394518d4ac5bfc7e64039cc4db934a66107 retained. Healthy/restarts0; money snapshotDML0, ENV,compose,mounts and12neighbors preserved. New backup checked, rollback image retained; image pinned in.env without another container recreation. Public health/version/env/guide200, three nonempty guide presets, support address and Metrica111392024 retained. Disk remains above10GiBguard.

One05.10 backup transferred to private local storage, all11files/SHA256/sizes and tar/dump reading verified; only its server copy removed after repeat CAS. Latest server backup retained. Own3temporaryE2Eservices/empty network removed,77foreigncontaineridentities/249volumes/21foreigntrackedfiles preserved; all foreign runtime states unchanged is not claimed. Evidence: private airis-screen-capture-cleanup-20261007/release-acceptance.json with hash-bound references.

SDDcompleted3/3. Plan remains198/244,46open,zero new numbered closures,goalactive. Actual people/usefulness/phone/Inbox/bothoperators/newpayment/24h/72h/14d/maturecohort remain separate open criteria. Docs publication does not change the accepted runtime source above.

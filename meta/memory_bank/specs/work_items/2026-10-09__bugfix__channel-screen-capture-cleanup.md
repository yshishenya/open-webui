# Release channel screen capture on failed frame acquisition

SDD Spec: meta/sdd/specs/completed/airis-channel-capture-cleanup-2026-10-09-009.json

Workflow: bugfix. Status: Source accepted; integration/deployment pending. Owner: Codex.
Branch: codex/bugfix/channel-screen-capture-cleanup.
Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit accepted source dependency3970d436bbab5d6dd3b0ccb128bb9762e3836374.

## Root cause and scope

While tracing channel input type errors, found the same one-shot capture leak previously fixed in chat input. Channel's screenCaptureHandler stops tracks only after successful drawImage and detaches video after all conversion/fetch/attachment work. Play, missing canvas context or drawing failure leaves capture active; downstream failure leaves video attached. The channel attachment menu is the only direct caller. Existing chat, call and voice capture paths were searched; call/voice own separate long-lived sessions with their existing lifetime regressions.

Apply the existing chat try/finally pattern locally to the channel handler. No new helper or subsystem is needed for a short component-local resource scope. Keep cursor=never/audio=false, PNG filename/type and the existing file handoff. This work does not yet address the remaining132 channel/input type diagnostics, aside from the two directly corrected native capture diagnostics.

## Measurable acceptance

- [x] Permanent actual-handler regression covers both channel and chat input; proves original channel failure and preserves the already fixed chat path.
- [x] All acquired tracks stop exactly once and video srcObject=null on play/context/draw/conversion/fetch/handoff failure and success; denial acquires no tracks.
- [x] Release happens before conversion/fetch/handoff; success creates exactly one PNG attachment, without requesting real screen/device permission in tests.
- [x] Full Docker frontend/backend suites, source/hash preservation and general type/lint diagnostic comparison; zero new diagnostics and no suppressed checks.
- [x] Changed handler fully annotated, no dependencies/config/schema changes; protected primary/production preserved; isolated source/docs committed and remote SHA verified.
- [ ] PR/integration/compiled candidate/production acceptance separately proven before deployment completion.

## Upstream impact / rollback

Only screenCaptureHandler in upstream-owned channel/MessageInput.svelte changes. Extend the existing fork-owned screen_capture_cleanup.test.ts instead of adding a test framework. Keep unrelated component functions/template unchanged. Rollback is reverting the isolated source commit. Work item2026-10-07**bugfix**screen-capture-cleanup.md supplies the accepted chat pattern; its completed evidence is not reused as channel acceptance.

## Verification and delivery boundary

Use the existing Svelte parser/TypeScript/Vitest actual-handler harness and existing Docker Compose bases. MDN APIs and installed dependency versions were reviewed in the prior accepted capture work; no unfamiliar API or new dependency is introduced. Preserve the overall red quality gate, missing preflight, G14/13.11/13.16 and full A/B/real pilot criteria. Numbered onboarding plan stays198/244 until its own criteria are proven.

## Verified source and compiled preview — 2026-10-09

Source `862fb285f1b283884df491e311fb381584527e5d` pushed; exact remote SHA verified. Diff: two files, 29 insertions / 22 deletions. All bytes outside the channel screenCaptureHandler are identical; no backend, other runtime file, dependency, configuration or schema changes.

Original focused test: chat8/8 passes, channel7failures/1pass; fixed16/16 across both components. Full Docker: backend1025 passed, zero failures/errors/skips; frontend960passed/123files. Black454, Ruff547 unchanged. Type errors2271→2269, warnings108; ESLint1020 unchanged. Normalized complete type-message and multi-line lint-message comparisons: zero added diagnostics. All454backend/1061frontend hashes frozen through checks.

Clean Git copy with the two source overlays compiled successfully using Node's8192MiB heap limit; first default2048MiB run terminated with heap OOM. Both logs retained. No application flag or dependency changed to work around the build. Compiled manifest:5721files/199843802bytes. This proves a static build, not a new Docker image.

The compiled static build was served readonly by the existing runtime base with the tested backend source mounted readonly and a fresh SQLite tmpfs. Ordinary fixture role=user signed in, opened its own private group channel, typed a draft and clicked the actual More→Capture menu. Disposable native API doubles rejected video.play: requests1/stopped2/video detached=true; the original draft stayed intact and could be replaced. Zero Runtime.exceptionThrown events during the observed action. No real media permission or personal capture was requested. Doubles were scoped to this temporary tab and disappeared when it closed. Screenshot and DOM saved. The narrow menu probe does not prove full onboarding, independent usefulness, physical device or new-image acceptance. A local analytics-revocation confirmation warning was observed in this standalone preview and not presented as a production diagnosis.

Production before/after:source c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy/restarts0; image/environment/configuration/mounts and12neighbors present at this stage's start match. Two terminal containers recorded in the previous stage were already absent before this baseline; cause not established, no remote Docker mutation performed. All21protected primary files match. Own PostgreSQL fixture and preview removed; read-only Git/build copy removed after source+compiled hashes checked. Persistent fixture volumes0, existing network/dependency cache preserved. An initial cleanup guard incorrectly expected tmpfs in Mounts; reconstructed Docker metadata without starting the app confirms two readonly binds plus HostConfig.Tmpfs, and that metadata-only probe was removed.

Proof:`/Users/yshishenya/.codex/private-artifacts/airis-channel-screen-capture-20261009`:test-acceptance.json,scope-preservation.json,compiled-manifest.json,compiled-browser-acceptance.json,compiled-channel-result.png,verify-checks.py,preview-native-doubles.js,seed-preview.py,production-preservation.json,primary-preservation.json,cleanup.json and source/build/check logs. Temporary compiled bytes are intentionally removed; manifest and evidence remain.

SDD2/2 source tasks completed. PR/integration/immutable candidate image/production acceptance remain pending. OverallqualityG14/13.11/13.16 remains red; no preflight script exists. Numbered plan198/244,46open,zero new numbered closures; final goal active. Phone, real mail/Reply-To/two operators, independent usefulness, payment/receipt and voluntary24h/72h/14d/mature cohort remain separate.

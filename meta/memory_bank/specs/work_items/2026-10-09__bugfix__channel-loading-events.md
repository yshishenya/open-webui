# Preserve channel events across initial loading and navigation

SDD Spec: meta/sdd/specs/completed/airis-channel-loading-events-2026-10-09-010.json

Workflow: bug_fix. Owner: Codex. Status: Source and compiled preview accepted; release pending.
Branch: codex/bugfix/channel-loading-events.
Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit source dependency63eb2c5b356a4a98d5a0bb34b1fff76659ad4a72.

## Root cause and scope

Channel and Thread register live socket events while messages=null during API loading. Channel calls array methods on null; Thread skips events and can lose changes newer than the HTTP snapshot. Async initial loads may also complete after navigation and replace the new selection. Trace both listeners, API callers, backend event emitters and every asynchronous message assignment before changes. Reproduce with actual component scripts and controlled deferred requests.

## Measurable acceptance

- [x] Reproduce original failures; leave runnable actual-handler regression.
- [x] Both components apply matching message/change/delete/reply/reaction events after initial loading; no null-list exception or silent lost event.
- [x] No duplicate when the same message is already in the HTTP snapshot or socket is replayed.
- [x] Late responses/events from an earlier selection cannot replace the current channel/thread, including A→B→A and unmount.
- [x] Failed loading does not produce an unhandled rejection; user-safe error is retained.
- [x] Full frontend tests and type/lint comparison; formatting; no new dependencies or suppressed checks. Backend remains byte-identical to accepted dependency.
- [x] Production/protected primary preserved; source/docs committed, pushed and exact remote SHA checked.
- [ ] PR/integration/new candidate image/production acceptance remain separately pending.

## Implementation constraints and upstream impact

Use a component-local pending initial-load promise and monotonically increasing selection version. Avoid a second message cache/queue and new runtime helpers. Reuse existing API/backend contracts for event types. Keep existing template and submission flow; guard every asynchronous assignment belonging to this selection. Only upstream Channel.svelte and Thread.svelte plus fork-owned types/regression change. Installed Svelte/TypeScript/Vitest tooling and promise semantics are already used in accepted tests; no unfamiliar dependency or integration introduced.

Rollback: revert this isolated source change. Do not claim onboarding numbered closures from this source-only check. General quality and missing preflight remain separate gates; final goal active, plan198/244.

## Verified source and compiled preview — 2026-10-09

Source `1e47c9d3f65e843e281077cc64e9d985bc1b728e` committed and pushed; remote source SHA verified. Four source/test files:349insertions/54deletions; backend and other runtime files unchanged. API request/response payloads, dependency pins, schema and application configuration unchanged. Consumed socket types intentionally describe only fields read by these handlers; broader legacy message and channel typing remains separate.

Permanent actual-script tests: original22failures, fixed22/22 across Channel/Thread. Cases cover six live message event types while loading, duplicated snapshot/replayed delivery, A→B→A responses, waiting events after navigation, destruction and failed loading. The request fixture waits until each request has actually started; initial one-microtask scheduling assumptions were corrected without weakening timeouts. In the first harness correction, a missing VM request-counter binding was fixed. Final identical test ran against original components via readonly overlays and corrected source. Full Docker frontend982/124files; backend1025,failures/errors/skips0. Black454 and Ruff547 unchanged. Types2269→2230,108warnings; ESLint1020→1019. Full diagnostic comparison:40type messages removed,one existing Thread null-property message replaced by a never-property message at the safe optional access;zero added lint diagnostics. This is explicitly recorded, not represented as zero added messages or a green overall gate. All454backend/1062frontend source hashes frozen and equal the compiled source copy.

A clean temporary Git copy compiled with Node heap8192MiB:5721static files/199848734bytes. The first build, concurrent with the backend suite and quality tools, ended withSIGKILL during gzip calculation. Its exact cause was not established; successful repeat ran separately after checks completed and after only its own temporary build output was cleared. Both logs preserved; no dependency, runtime flag or application check was relaxed.

Compiled UI served on loopback by existing runtime base with readonly tested backend/static binds and fresh SQLite tmpfs. Ordinary fixture role=user entered its own private group channel. A local fetch-return probe held the already captured initial HTTP snapshot while a real authenticated backend POST emitted a socket message. After release, that message appeared exactly once. The same probe held the thread snapshot (parent+old reply), then a real backend POST emitted a new reply; after release, old and new reply each appeared once, and parent reply count became2. Runtime.exceptionThrown0 over the observation; no truncated events. Screenshot/DOM and snapshot IDs recorded. This proves actual compiled component/HTTP/socket interaction, not a new Docker image, production, physical device, independent usefulness or voluntary pilot.

Raw CDP Page.addScriptToEvaluateOnNewDocument was unsupported; no reload injection was used. The supported Runtime.evaluate probe was attached only to the existing local document before normal sidebar navigation. One initial REPL cursor binding and a read-only Playwright evaluation of the developer-only global were corrected; probe state was then read through CDP. No application exception was registered. Local analytics-revocation warning matched the standalone preview observation from prior work and was not attributed to production.

Temporary tab closed and probe removed with it. Own PostgreSQL fixture, preview and clean Git/build copy removed after all5721compiled hashes were checked. Metadata confirmed two readonly binds plus HostConfig.Tmpfs and no persistent fixture volumes; shared network/cache retained. Production still sourcec0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy/restarts0; image/ENV/config/mounts and12neighbors from this stage baseline identical. All21protected primary files unchanged. No remote Docker mutation.

Proof:`/Users/yshishenya/.codex/private-artifacts/airis-channel-loading-events-20261009`:verify-checks.py,test-acceptance.json,diagnostic-comparison.json,pre-test-source-snapshot.json,compiled-manifest.json,compiled-browser-acceptance.json,compiled-channel-dom.txt,compiled-channel-result.png,preview-loading-probe.js,seed-preview.py,post-preview-event.py,production-before.json,production-after.json,cleanup-before.json,cleanup.json and source/build/test logs. Final documentation SHA and Git-blob hash verification are recorded in receipt.json after delivery.

Overall quality remains red; npm preflight absent; PR/integration/candidate/new image/production acceptance pending. Numbered plan198/244,46open,new numbered closures0; goalactive. Full A/B mail/Reply-To/two operators/payment/receipt/device/human/pilot24h/72h/14d/mature cohort remain separate. Next technical block: concrete channel/message contracts and remaining input type diagnostics, then the full preliminary quality gate.

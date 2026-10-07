- [x] **[DOCS][BUG][CHAT]** Record accepted screen capture cleanup
  - Spec: `meta/memory_bank/specs/work_items/2026-10-07__bugfix__screen-capture-cleanup.md`
  - Owner: Codex
  - Branch: `codex/docs/screen-capture-acceptance`
  - Summary: Complete SDD and record exact-source/browser/production acceptance while leaving global quality and human/calendar criteria open.
  - Done: 2026-10-07
  - Tests: Staged SDD schema/policy, scoped formatting and diff checks; runtime evidence stays bound to3bcb2af94c.

## Final acceptance — 2026-10-07

PR349: https://github.com/yshishenya/open-webui/pull/349. Accepted source `3bcb2af94c3cd6d73c66d74350da6a1f26932301`, merge `01c69d4e23a6c84820843636af8e402f84ed157d`; trees equal. Exact-source CI passed, including billing-confidence; dependency-review skipped and CodeRabbit review skipped. Source frontend891/891,108files; actual capture regression before7failed/1passed, after8/8passed. Check3004→3002errors/118warnings, fullESLint1127unchanged, zero new diagnostics and scoped lint0. GlobalqualityG14/13.11/13.16 remains open.

Compiled candidate: Chromium34/34 and Firefox390px34/34, total68, no failures/errors/skips; 2globalSetup excluded. The real Capture menu failure scenario uses disposable native media doubles: both tracks stop, video detaches, draft remains usable; no real screen/device permission requested. All6542 originalsourcehashes preserved;4915frontend/496rawbackend accepted. Related CallOverlay and VoiceRecording lifetime defects are separately reproduced and not fixed by this release.

Production release `20261007T120403Z-screen-capture-3bcb2af94c-20261007` accepted, digest `sha256:5e5c6f0ccef95f5b7184c63d1b99a1e11b218802068a3a031ac49fc50ff5cd95`. Live4915frontend/427Pythonhashes match the candidate; backend6a2b5394518d4ac5bfc7e64039cc4db934a66107 retained. Healthy/restarts0; money snapshotDML0, ENV,compose,mounts and12neighbors preserved. New backup checked, rollback image retained; image pinned in.env without another container recreation. Public health/version/env/guide200, three nonempty guide presets, support address and Metrica111392024 retained. Disk remains above10GiBguard.

One05.10 backup transferred to private local storage, all11files/SHA256/sizes and tar/dump reading verified; only its server copy removed after repeat CAS. Latest server backup retained. Own3temporaryE2Eservices/empty network removed,77foreigncontaineridentities/249volumes/21foreigntrackedfiles preserved; all foreign runtime states unchanged is not claimed. Evidence: private airis-screen-capture-cleanup-20261007/release-acceptance.json with hash-bound references.

SDDcompleted3/3. Plan remains198/244,46open,zero new numbered closures,goalactive. Actual people/usefulness/phone/Inbox/bothoperators/newpayment/24h/72h/14d/maturecohort remain separate open criteria. Docs publication does not change the accepted runtime source above.

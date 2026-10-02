# AIRIS guide walkthrough video

Status: Done
Owner: Codex
Branch: `codex/feature/guide-walkthrough-video`
SDD Spec: `meta/sdd/specs/completed/airis-guide-walkthrough-video-2026-10-02-206.json`

## Goal and measurable acceptance

Publish the recorded guide walkthrough using the native browser player on the existing public guide. The 70-second recording shows a prepared letter, actual free answer, clarification and wallet. Use local same-origin assets; no new player dependency or API.

- [x] Player has controls, playsinline, preload none, no autoplay; Russian caption track present and selected. Text instructions remain readable when media fails.
- [x] Video 60–90 seconds, valid H.264 1280x720, no profile photograph or private content; VTT valid and timed to video; transcript available without playback.
- [x] Existing 156 frontend tests, touched-file checks, build and focused guide E2E pass. Source CI and PR accepted on exact SHA.
- [x] Guarded production release preserves active backend/config and independently deployed analytics; asset hashes, media response/byte range and visible player verified.

## Implementation and upstream impact

Add 3 small media/text assets under static/airis/guide. Add a native video section to fork-owned src/routes/guide/+page.svelte, with a text download and current-conditions note. Reuse existing guide and public layout. No upstream-owned file or dependency changes. Extend existing guide E2E with media behavior checks.

## Limits and rollout

The recording uses an existing signed-in session; it does not prove fresh login/signup or a physical phone. It does not perform a payment or prove human acceptance. Telegram publication and real pilot windows remain separate. Run backup/migration/rollback/health gates for release without lowering disk threshold.

## Source acceptance 02.10.2026

PR160 source `f50d9db1857d620cb8aa52d694baf706eab6d0f1` accepted with 12 observed CI statuses; merge `f2bfb1db11c51bcf1e7b31c6fb4631f31b58340d`. Dependency review was skipped without dependency changes; CodeRabbit review was skipped by target-branch configuration and is not claimed as a human review. Touched checks and 156 Vitest tests pass, 7 Docker guide scenarios pass. Supported Node 22.23.3 macOS build succeeds after Docker SIGKILL; no other project was stopped. Version and all 4903 candidate frontend files match frozen source; stable asset paths lost 0. General type/lint debt remains separate and open. Native player actual playback,10 loaded Russian cues and keyboard play/pause verified. Production acceptance completed below.

## Production acceptance 02.10.2026

Healthy frontend-only release matches all 4903 build hashes and all 3 public asset hashes. The current independently released backend is preserved. Native playback 70.24s, 10 default Russian caption cues, keyboard pause, readable text link, 390/1440 responsive views and 206 byte-range response verified. Guarded backup/migration/rollback and unchanged runtime configuration checked. SDD206 4/4 completed.

Fresh production login, physical-phone testing, real payment, Telegram publication and the real pilot remain outside this feature acceptance and are open in the overall plan.

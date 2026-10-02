# AIRIS guide walkthrough video

Status: In Progress
Owner: Codex
Branch: `codex/feature/guide-walkthrough-video`
SDD Spec: `meta/sdd/specs/active/airis-guide-walkthrough-video-2026-10-02-206.json`

## Goal and measurable acceptance

Publish the recorded guide walkthrough using the native browser player on the existing public guide. The70-second recording shows a prepared letter, actual free answer, clarification and wallet. Use local same-origin assets; no new player dependency or API.

- [ ] Player has controls, playsinline, preload none, no autoplay; Russian caption track present and selected. Text instructions remain readable when media fails.
- [ ] Video60–90 seconds, valid H.2641280x720, no profile photograph or private content; VTT valid and timed to video; transcript available without playback.
- [ ] Existing156 frontend tests, touched-file checks, build and focused guide E2E pass. Source CI and PR accepted on exact SHA.
- [ ] Guarded production release preserves active backend/config and independently deployed analytics; asset hashes, media response/byte range and visible player verified.

## Implementation and upstream impact

Add3 small media/text assets under static/airis/guide. Add a native video section to fork-owned src/routes/guide/+page.svelte, with a text download and current-conditions note. Reuse existing guide and public layout. No upstream-owned file or dependency changes. Extend existing guide E2E with media behavior checks.

## Limits and rollout

The recording uses an existing signed-in session; it does not prove fresh login/signup or a physical phone. It does not perform a payment or prove human acceptance. Telegram publication and real pilot windows remain separate. Run backup/migration/rollback/health gates for release without lowering disk threshold.

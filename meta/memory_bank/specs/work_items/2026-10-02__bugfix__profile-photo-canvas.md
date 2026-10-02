# Profile photo Canvas failure

## Meta

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/profile-photo-canvas
- SDD Spec: meta/sdd/specs/active/airis-profile-photo-canvas-2026-10-02-215.json

## Cause and scope

Photo upload dereferences a null Canvas2D context at drawImage. The shared UserProfileImage component is used by account settings and administrator user editing. Prior avatar-helper guards do not cover photo cropping. Reproduced using the actual upload callback.

## Acceptance

- [x] Trace both callers and reproduce the missing-context failure.
- [x] Missing Canvas displays the existing translated upload error, keeps the previous avatar and permits selecting the same file again.
- [x] Normal cover crop remains 250x250 with WebP quality0.8.
- [ ] Regression fails on original source, passes after the fix; both real isolated browser forms preserve the avatar and have zero uncaught errors.
- [x] Docker frontend suite and changed-file quality pass; zero new full strict/lint messages.
- [ ] Exact-source CI, merge and frozen production image accepted with verified backup/rollback.

## Upstream impact and compatibility

Only the existing shared UserProfileImage.svelte upload path changes. Reuse native FileReader/Image/Canvas, existing toast and translated message; no dependency, renderer or original-size fallback. Both callers retain their existing API contracts. Installed TypeScript5.9.3, Vitest1.6.1 and Playwright1.62.1 are reused; upgrades remain separate compatibility work. Full global diagnostics remain an independent acceptance gate.

## Verification and rollback

Execute the actual input change handler for missing Canvas and normal crop. In isolated Docker test account and administrator forms with a synthetic PNG, repeated selection, unchanged save payload and zero uncaught errors. Freeze source/build hash and frontend/backend manifests; preserve environment, mounts, network, ports and neighboring containers, with at least10GiB after backup/pull. Retain the latest accepted rollback image.

## Source evidence

Actual original handler fails at drawImage; both original browser forms reproduce the same uncaught error. Fixed handler passes2/2 controls; full Docker frontend197/197 across45 files. Changed-file Prettier/ESLint pass; full strict4676→4668 errors,215 warnings, zero new messages. Full ESLint1600 errors remain; zero new messages. Browser candidate and frozen release are pending.

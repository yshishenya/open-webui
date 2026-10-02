# Avatar Canvas fallback

## Meta

- Type: bugfix
- Status: in progress
- Owner: Codex
- Branch: codex/bugfix/avatar-canvas-fallback
- SDD Spec: meta/sdd/specs/active/airis-avatar-canvas-fallback-2026-10-02-214.json

## Reproduced cause and scope

When getContext("2d") returns null, canvasPixelTest throws at putImageData and generateInitialsImage fails before signup or profile APIs run. All callers were traced: auth signup, account rename, profile rendering/initials and administrator creation/import. Profile callers may pass an absent user name.

## Acceptance

- [x] Reproduce both real helper failures and inspect every caller.
- [x] Return false from the pixel probe without accessing a missing context.
- [x] Use existing /user.png for an unavailable context; preserve normal initials and pixel-mismatch fallback.
- [x] Accept absent profile names with concrete nullable string types.
- [ ] Regression fails before the fix and passes afterwards; isolated browser signup and profile update succeed without Canvas.
- [x] Docker frontend suite and changed-file quality checks pass; zero new strict/lint messages.
- [ ] Exact-source CI/merge and frozen frontend image accepted on production with rollback available.

## Compatibility and upstream impact

Only two existing helpers in upstream src/lib/utils/index.ts change. No caller guards, renderer or dependency is added. Native DOM Canvas contract returns a nullable context. Reuse pinned TypeScript5.9.3/Vitest1.6.1/Playwright1.62.1; version upgrades remain separate compatibility work. Existing file-upload image cropping is a separate caller-owned Canvas path outside this avatar-generation fix.

## Verification and rollback

Extract actual helper initializers using the installed TypeScript AST; verify both missing-context positions, pixel mismatch, normal initials and absent names. Run real signup/profile browser controls only in isolated Docker, with no payment/provider calls. Retain full global diagnostics and their delta. Release by verified frontend overlay on accepted backend, preserving environment, data, neighboring containers and >=10GiB free after backup/pull. Roll back to the prior accepted image if live gates fail.

## Source verification

Original source fails both regression controls; fixed helpers pass2/2, full Docker frontend195/195. Changed-file Prettier/ESLint pass. Full strict4686→4676 errors,215 warnings; full ESLint1601 errors retained. Zero new strict or lint messages across all callers. Browser and production acceptance remain pending. An initial test-only typed-array inference error was corrected before this source freeze.

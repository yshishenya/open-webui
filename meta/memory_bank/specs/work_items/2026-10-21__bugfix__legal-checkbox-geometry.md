# Legal acceptance checkbox geometry

- Type: bugfix
- Status: released
- Done: 2026-10-22
- Owner: Codex
- Branch: `codex/bugfix/legal-checkbox-geometry`
- Created: 2026-10-21
- SDD Spec: N/A (small CSS correction)

## Context and acceptance criteria

Native checkboxes in `LegalAcceptanceGate.svelte` shrink beside long document titles.
The shared checkbox base style also applies `self-center`, overriding the row's
`items-start`. Keep each checkbox 16 × 16 CSS pixels and align it with the first
line in both checked states, at desktop and mobile widths.

## Scope and upstream impact

Add `shrink-0 self-start` to the existing Airis legal gate input classes. No API,
acceptance logic, dependency, or shared checkbox changes. Upstream-owned files: none.

## Verification

- Reproduce and measure actual rendered component with long Russian document titles.
- Verify desktop/mobile widths, checked/unchecked states, label and keyboard interaction.
- Run frontend tests and focused lint/format checks via Docker Compose.
- Record results in the branch update before marking done.

## Rollback

Remove the two utility classes from the legal gate input.

## Reproduction and measured result

On a 320px viewport, removing the two added classes from the actual rendered
component reproduces widths 8.6875, 6.390625, and 7.3125px at 16px height. The
first-line offsets are 28.125–39.5px. The browser check fails on this baseline.
With the fix, all three controls are 16 × 16px with a 4px first-line offset at
320, 390, and 1280px, checked and unchecked. Space and label clicks toggle them.

Reusable regression check (open the legal gate in a Playwright CLI session first):

```sh
playwright-cli run-code --filename scripts/check_legal_checkbox_geometry.js
```

The check measures rendered boxes and never submits legal acceptance. Temporary
fixture HTML imported the real component and application CSS through Vite; it was
removed after verification. Screenshots and logs remain in `output/playwright/`.

Frontend Vitest: 233 files / 2605 tests passed. Focused ESLint and Prettier passed.
The preflight phases run individually to reuse the completed full test suite.
Backend, migration, and SDD checks are not applicable to this CSS-only correction.

Full ESLint passed. Svelte check: 0 errors, 0 warnings. Production build passed with `AIRIS_VITE_SOURCEMAP=false`, matching Dockerfile (3m 43s). The exploratory build with source maps enabled was stopped after excessive resource use; its log is retained.

## Production acceptance — 2026-10-22

PR #374 merged as `9ebb6fe8f3a6a47ac62f8d322f2b29a27e5e1df4`.
All source PR gates passed; a separate exact-SHA merge-medium billing run
[39679865705](https://github.com/yshishenya/open-webui/actions/runs/39679865705)
passed all four suites after the integration-branch run was superseded.

The shared production rollout includes this correction and PRs #375/#376.
Installed source: `8e6679015b57ed522c43f70ee4094d526a279b28`, already merged
through `d56214417` in `airis_b2c`. Its source CI passed. Image:
`yshishenya/yshishenya:email-signin-8e6679015b-20261022`, digest
`sha256:232f91f37c62e4546128973c1f70b1dc5b266f06e971d55d7288d6804551cf16`.
The standalone checkbox image was accepted and published but not installed;
its guarded attempts stopped at the shared deployment lock. Its unused local
production copy was removed after the integrated replacement was confirmed.

Independent readback: public health succeeds, Docker healthy/zero restarts,
public version equals the installed source, all 4915 frontend files and 480
Python source files match the accepted shared candidate; all 351 Python package
versions match. The public layout asset checksum is
`7b4da51a7b1115a6999949794ae4017d559219cfd42150e8b2028ae40abf8ec4`.
Actual production assets render three 16 × 16px boxes with a 4px first-line
offset at 320/390/1280px, checked and unchecked; label and Space toggling pass.
The isolated browser substitutes API session/status responses and intercepts
all API writes. No real legal acceptance or account change was submitted.

Persistent mounts and all 12 persistent neighbors are unchanged. One temporary
terminal disappeared between snapshots; the two other initial terminals remain
unchanged. No terminal was removed by this task. Environment differs only in
WEBUI_BUILD_VERSION; configuration differs only in the two image selectors.
Wallet/payment/ledger/transaction fingerprints are unchanged (SELECT-only audit).
Verified private backup:
`AIris:/opt/backups/airis/20261021T214640Z-email-signin-8e6679015b-20261022`
(mode 700); the previous production image remains available for rollback.

Evidence: `output/playwright/production-after-geometry.log`, mobile/desktop
screenshots, and private manifests/logs under
`/Users/yshishenya/.codex/private-artifacts/airis-legal-checkboxes-20261022`.
The standalone builder, preview container and temporary source/resources were
removed; registry images, logs and manifests are retained. This acceptance
covers the checkbox correction; unrelated authentication work keeps its own gates.

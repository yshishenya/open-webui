# Legal acceptance checkbox geometry

- Type: bugfix
- Status: done
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

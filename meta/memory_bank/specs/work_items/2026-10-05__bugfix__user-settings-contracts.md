# User settings contracts

- Type: bugfix
- Status: done (implementation and local verification; integration proof recorded in PR)
- Branch: codex/bugfix/user-settings-contracts
- SDD Spec: meta/sdd/specs/completed/airis-user-settings-contracts-2026-10-05-2049.json

## Problem and root cause

Settings UI persists boolean switches, string model/tool IDs and direct terminal connections. The shared Settings declaration omits these fields and types pinnedModels as never[]. Strict checks therefore fail in sibling consumers despite supported runtime values. This is part of G14 / plan 13.11; the global gate remains open until all diagnostics are resolved.

## Scope and traced flow

Interface.svelte creates, saves and restores boolean switches. Models.svelte pins string model IDs; Chat restores tool IDs. Integrations/Terminals and AddTerminalServerModal store url, name, key, auth_type, path and enabled; TerminalMenu, Chat, FileNav and both layouts consume those values. ChangelogModal saves the string config version. Settings.set retains the existing object and defaults.

## Measurable acceptance

- [x] Strict compiler probe accepts empty/real settings, string selections, disabled/enabled terminals and optional connection credentials; rejects wrong boolean/ID/URL types.
- [x] Reproducing probe fails before the declaration repair and passes afterwards.
- [x] Full frontend tests pass; mapped full type/lint diagnostics have zero additions and a measured reduction.
- [x] Complete emitted JavaScript of both modified runtime modules is byte identical before/after; no executable application delta.
- [x] SDD, spec and branch log finalized for source delivery to airis_b2c. Exact source, CI and merge acceptance are recorded in the PR and the separate acceptance record.

## Upstream impact

Only the Settings type declaration and a type-only import in stores/index.ts. Put the terminal settings shape in the existing fork-owned frontend-contracts.ts. No runtime hook, new dependency, public API, migration, configuration change or whole-file formatting.

## Verification and rollback

Docker Compose strict probe, full npm run check, npm run test:frontend, full ESLint diagnostic comparison and focused formatting. Use original strict tsconfig.json without permissive overrides. Erased type-only changes require no production recreation. Revert only the declarations on regression. Floating action buttons and other untraced contracts are outside this repair.

## Verified result

- Strict probe has 11 failing diagnostics before the repair and 0 after it. Assertions cover all twelve restored switches, string model/tool selections, minimal/complete terminal connections, wrong IDs/booleans/URLs and the stored version.
- Full frontend tests: 555/555 in 80 files, through Docker Compose.
- Full strict check: application errors 3733 -> 3662; 71 removed, 0 new, warnings remain 159. One existing missing floatingActionButtons diagnostic gains a Did you mean showFloatingActionButtons suggestion; path/line and original issue are unchanged. The baseline total 3744 includes eleven deliberately failing probe diagnostics, not eleven new application defects.
- Full ESLint: 1384 -> 1384, exact mapped diagnostic list unchanged. Full check and lint commands still exit nonzero because of this existing debt; plan 13.11 remains open. No strict setting was disabled and no assertion or suppression added to runtime source.
- Complete emitted JavaScript of stores/index.ts and frontend-contracts.ts is byte identical: 3506 and 11 bytes respectively. Existing components, backend, configuration, migrations and dependency pins are unchanged. No application deployment is needed for erased declarations.
- Focused formatting and typecheck-file ESLint pass. npm run preflight is absent; actual test/type/lint/format commands were run directly.

## Acceptance evidence boundary

This repair completes one bounded source-quality task, not the full onboarding/retention goal. Real SMTP external delivery, pilot eligibility and calendar/cohort acceptance remain separate. CI must be read on the final source revision and integration trees compared before recording this repair as delivered.

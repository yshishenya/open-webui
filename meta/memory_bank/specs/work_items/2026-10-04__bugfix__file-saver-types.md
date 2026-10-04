# File export type contract

- Type: bugfix / quality gate
- Status: completed
- Owner: Codex
- Created: 2026-10-04
- Workflow: bug_fix

## Problem and goal

The installed file-saver package has no declaration in this repository. The full type check therefore loses type information at every import used by chat/note/file exports. Add only the used export contract and verify valid and invalid calls without changing runtime or introducing a dependency.

## Measurable acceptance

- [x] Every previously missing file-saver declaration diagnostic is removed; zero new type errors or warnings are introduced.
- [x] Named saveAs and default.saveAs accept Blob/File/URL, optional filename and documented autoBom options; invalid argument types are rejected by the compiler.
- [x] Existing frontend tests and strict lint/format of changed files pass.
- [x] Source runtime, dependencies, database and production image remain unchanged.
- [x] Commit, exact-head CI and integration receipts are recorded; global G14 remains open while other errors persist.

## Existing components and version evidence

Reuse file-saver2.0.5, already pinned in package-lock.json. Current npm latest is2.0.5. Read the official README shipped with that exact installed version: saveAs(Blob/File/Url, optional filename, optional {autoBom}). All existing callers use this signature. No new abstraction or runtime wrapper is needed.

## Scope and upstream impact

Add a fork-owned declaration file under src/lib/types/. Existing runtime files, including an old ts-ignore in automations, are left byte-identical; no unrelated page lint cleanup. No upstream runtime change, dependency replacement, API or migration. This narrow declaration task uses the existing full type check as regression proof; no SDD required for a trivial declaration with no runtime logic.


## Source verification

The declaration restores exactly21 previously missing file-saver import diagnostics:4225 errors/174 warnings becomes4204/174; added diagnostics0. The compiler accepts named/default/URL/Blob/File calls and rejects invalid data, filename and autoBom types (exactly3 expected errors). All443 frontend tests pass in66files. Strict ESLint and Prettier of the only new declaration pass.

An attempted removal of an obsolete ts-ignore exposed two existing unrelated automation-page lint errors. That comment edit was reverted; all runtime files remain byte-identical. No page cleanup or runtime change is included. The first official GitHub README URL returned404; the exact installed package README was read instead, and current npm metadata confirms2.0.5 is latest.

Exact-source full check confirms4204/174 after restoring the runtime file; all21 declaration errors removed/0added. Full lint remains1503 errors/0added/0removed. Source commit and exact-head CI accepted. Production redeployment is unnecessary for a declaration-only change. General G14 remains open.


## Integration acceptance

PR234 merged: source `e35a66e55073ffd2e894d22c513878ce97ce13c7`, merge `2ef78e24ce32d6a880d5c4dbc2c45dcba061686f`. Ten CI checks succeeded; dependency-review was skipped. CodeRabbit reviews are disabled for the base branch; no independent review is claimed. Runtime/dependency files remain byte-identical. Type errors4204/warnings174 and ESLint1503 remain the explicit global debt. Documentation closure is carried separately.

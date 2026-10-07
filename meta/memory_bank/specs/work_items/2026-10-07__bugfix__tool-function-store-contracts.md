# AIRIS function selector contracts and bulk selection accessibility

- Type: bugfix
- Status: completed
- Workflow: bug_fix / workflow-compliance
- Owner: Codex
- Branch: `codex/bugfix/tool-function-store-contracts`
- Created: 2026-10-07
- Done: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-function-store-contract-2026-10-07-001.json`

## Cause and final behavior

The functions store inferred only null, losing response fields in all list readers.
Declare the existing GET /functions/ FunctionResponse in the fork-owned contracts
file and annotate the store, preserving null loading/failure state. Nullable server
descriptions flow through the existing selector chain. Type-only i18n imports and
three unused-index removals clean existing touched-file lint debt.

The shared bulk option was missing aria-selected. It now announces false for none
or partial selection, and true when every matched item is selected; the existing
Enable all action is preserved. This accessibility change requires a frontend release.

## Measurable acceptance

- [x] All writers/readers and server schema fields traced; nullable owner,
      descriptions/manifests and optional toggle metadata preserved.
- [x] Types 3312 to 3303 errors, warnings 130 to 129; normalized new diagnostics 0.
- [x] Full ESLint 1227 to 1218; new diagnostics 0, changed files ESLint 0, format clean.
- [x] Frontend 819/819 in 99 files; baseline bulk-ARIA regression fails as expected.
- [x] 23 compiler comparisons accept only three unused-index removals and one
      ARIA attribute; all remaining emitted JavaScript/CSS matches baseline.
- [x] Chromium/Firefox 6/6 actual compiled bulk-option checks; none/partial/all
      false/false/true, actual Enable all selects both matched IDs, page errors 0.
- [x] Candidate onboarding/payment pack 24/24 in Chromium/Firefox; service healthy
      before setup, replay gives no double credit/email, provider errors consume no quota.
- [x] Exact source CI accepted and source/merge trees identical.
- [x] Guarded release: verified backup, hard Alembic gate, retained rollback,
      4914 frontend/427 backend hashes, health/restarts, environment/config,
      all accepted preflight neighbors and money hashes preserved; default image pinned.
- [x] SDD 3/3 completed. Private plan and evidence kept separate from public source.

## Source and release

Source: `fd86a17857b9ae490e371b92ecd1244043ccfe70`.
[PR333](https://github.com/yshishenya/open-webui/pull/333), merge:
`463e8031e2873abe075384fb28c2b0d1598e2b3a`; trees identical. Applicable checks completed successfully;
dependency review skipped, CodeRabbit disabled for this base branch.

Production tag: `function-selectors-fd86a1785-20261007`.
Registry/server identity: `sha256:8c1d46bd33239b644003fa7ed26e4646b5e731a10064f6338d1242eb2f19d54e`.
Backend source `6a2b5394518d4ac5bfc7e64039cc4db934a66107` and deployed static/Pyodide
assets unchanged; analytics env.js retained. Build uses existing build:vite with
preserved deployed static assets. No dependency, backend or schema changes.
Backup: `/opt/backups/airis/20261007T040025Z-function-selectors-fd86a1785-20261007`.
Rollback: `airis:rollback-20261007T040025Z-function-selectors-fd86a1785-20261007`.

## Upstream impact and remaining work

Fork-owned response type and one thin store annotation; upstream selectors receive
nullable declarations, existing i18n types, unused-index cleanup and one ARIA state.
No unrelated formatting or API changes. Global G14/13.11 remains open at 3303 type
errors/1218 ESLint; this scope does not claim global quality completion.

Tools/direct server contracts are a separate item. The initial combined probe
exposed latent tools-menu accumulator and redundant-name diagnostics; the server
contract is not weakened to hide them. Initial CI SDD naming/lint failures and
browser setup/alias/blur fixtures, offline pyodide fetch failure and the first path
setup ECONNREFUSED are retained as rejected attempts; final checks supersede them.

First release stopped before migration/recreate when one ephemeral user terminal
ended during backup. A fresh snapshot confirmed unchanged remaining neighbors,
image, environment, configuration and money. Retry reused the recent verified
backup with checksum/config/archive/age guards. One retry age-check syntax failure
was fixed and retained; both local and embedded remote shell parse checks passed.

The former authenticated browser tab is unavailable; no new live draft or ordinary
account acceptance is claimed. Inbox/real replies/operator access, physical phone,
independent usefulness, voluntary pilot and real 24h/72h/14d mature cohorts and
one historical payment remain separate conditions. Overall plan 198/244, goal active.

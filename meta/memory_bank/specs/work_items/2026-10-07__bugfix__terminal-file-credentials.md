# File operations must use the selected terminal credentials

## Meta
- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/terminal-file-credentials`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-terminal-file-credentials-2026-10-07-001.json`

## Context / root cause
FileNav defaults to the first stored terminal. Direct OpenAPI entries precede
system entries; presence of any stored entry is mistaken for system identity.
With no explicit selection, file calls can use the AIRIS session token for an
external direct URL instead of the matching configured key. Direct selection
already resolves from settings correctly; XTerminal classifies by id correctly.
Trace both getTerminal callers: reactive directory load and file export/change.
Resolve once in existing getTerminal; preserve the default order and selection.

## Acceptance
- [x] Failing synthetic test proves default direct uses AIRIS token before fix.
- [x] Default and explicit direct use only their matching configured key; missing
key stays empty; unconfigured direct returns null and never a session token.
- [x] Default/explicit system use session key; stale/no server yields no call.
- [x] Regression tests, changed-file style/types and no new full-check diagnostics.
- [ ] Exact source CI/merge, candidate/image and guarded production accepted.

## Scope / reuse
Three credential lines in existing shared FileNav resolver, one runnable regression with
synthetic keys. No dependency, backend, schema, permissions or config change.
No real external endpoint/credential used in verification. Existing TypeScript
5.9.3/Svelte5.56.0/Vitest1.6.1 graph retained; upgrades separate.

## Upstream impact
FileNav is fork-owned terminal integration. No broad component formatting,
public contract change or new abstraction.

## Verification / rollback
Docker Compose-first focused and full frontend tests; compile/check/lint baseline
comparison; frozen candidate assets and guarded backup before release. Preserve
current monetary data/config/neighbors. Image rollback restores prior behavior,
so prefer forward correction; do not simulate real credential exposure.

## Source verification
Actual shared getTerminal reproduction:3failed/5passed before,8/8 after.
Full frontend686/686. Fresh exact-base/full-source svelte-check3396errors/
150warnings and ESLint1288errors unchanged; complete diagnostic lists equal,
newdiagnostics0. Test ESLint0;existing FileNav11 same exact messages.
Existing TypeScript5.9.3 docs read;latest7.0.2 recorded. No dependency upgrade
or new runtime module; existing compiler graph retained. Docker network pools
exhausted on first attempt; test containers now network:none, no networks pruned.
Production/source CI/image task remains open; no deployed fix claimed yet.

## Required changed-file gate
The initial PR lint failed on all11 existing FileNav diagnostics (not the new
regression). Remove unused onAttach (no callers) and unused shift listeners,
keep event.shiftKey range selection; use currentPath for new chat CWD and let
loadDir persist the resolved path; explicit void retains store dependencies.
Delegate blank-area deselection to the existing window handler, preserving
Escape. Close3 existing non-void divs. No lint rules/checks disabled.
Candidate acceptance also covers directory navigation and deselection.

R2: FileNav/test ESLint0; frontend686/686; all type errors unchanged3396,
compiler warnings150→141. Existing full debt remains separate.

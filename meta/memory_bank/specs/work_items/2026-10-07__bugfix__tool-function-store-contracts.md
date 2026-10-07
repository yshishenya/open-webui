# AIRIS function selector contracts and bulk selection accessibility

- Type: bugfix
- Status: in progress
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/tool-function-store-contracts`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-function-store-contract-2026-10-07-001.json`

## Cause and scope

The functions store infers only null from writable(null). All readers lose
list item types. Mirror GET /functions/ FunctionResponse in existing fork-owned frontend-contracts.ts and add thin store
annotations. Preserve null as the real initial/failure state and all list loading
behavior. Tools and direct tool-server success/error unions remain separate tasks. The
first combined probe exposed redundant name/accumulator diagnostics in tools
menu assembly; do not hide these with loose response types.

## Measurable acceptance

- [x] Trace all store writers/readers and server schema fields, including null owners,
      nullable descriptions/manifests and toggle metadata.
- [x] Reduce the3312 baseline type errors with0 new normalized diagnostics;
      no casts, Any, suppression, dependency or configuration changes.
- [x] Compiler delta limited to removal of unused each indices and one
      aria-selected state for Enable all; remaining emitted JS/CSS identical.
- [x] Enable all announces false for none/partial and true for all; actual
      selection behavior passes compiled browser checks before guarded release.
- [x] Full frontend tests pass; all changed files ESLint0, clean formatting,
      full lint decreases9 without new diagnostics.
- [ ] Exact source CI accepted, identical source/merge trees, SDD closed.
- [ ] Private plan/proofs updated; globalG14/13.11 and full goal remain open.

## Upstream impact and rollback

Existing fork-owned contracts hold response types; upstream-owned stores get
minimal type annotations. Only type declarations in affected selectors may
change if server null fields require them. No backend/API behavior change.
Accessibility attribute requires frontend release. Preserve backend, deployed
static assets, analytics, environment and user data. Guarded backup/hash/health
acceptance and existing full onboarding path pack required.

## Local evidence

Final scope: one function response type, one nullable store annotation and nullable
description declarations in seven selectors. 3312 to3303 errors,129 warnings,new0;23 compiler/erasure/CSS checks match only unused index
removal and one bulk option ARIA attribute. Full819 tests pass;format clean,
changed files ESLint0,full1227 to1218. Chromium/Firefox6/6 bulk checks passed.
CI exposed9 existing touched-file lint failures; clean old casts/unused indices
and add missing aria-selected to Enable all. Browser/guarded release required. Shared tools
assembly and tool-server unions remain separate work. GlobalG14/13.11 stays open.

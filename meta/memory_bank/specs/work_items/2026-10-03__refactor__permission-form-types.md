# Permission form type contracts

## Meta

- Type: refactor
- Status: active
- Owner: Codex
- Branch: `codex/refactor/permission-form-types`
- SDD Spec: `meta/sdd/specs/active/airis-permission-form-types-2026-10-03-0230.json`
- Created: 2026-10-03 (Europe/Istanbul)

## Context and measured baseline

Integration base `b0a248c7e35370206a068c3133034d3fab29a578`. Fresh Compose strict check:4631 errors/179 warnings. Permissions.svelte contributes189 property accesses on inferred empty objects; EditGroupModal contributes7 invalid accesses on group inferred as null/never. Existing normalization fills six sections, preserves explicit false and unknown extensions. Groups APIs store permissions as nullable dictionaries, so missing settings must remain supported.

## Acceptance

- [x] Empty/partial settings, true/false overrides, defaults, extensions and repeated initialization preserve current behavior.
- [x] Editing and serialization preserve actual permissions; DEFAULT_PERMISSIONS is not mutated.
- [x] Permissions.svelte has zero type errors; changed callers/helper/tests lint clean; no new diagnostics in callers.
- [x] Full frontend suite passes on exact source; type/lint debt decreases with rules unchanged.
- [x] Compiled runtime compared to base; identical runtime needs no image release, changed runtime requires candidate/browser acceptance and guarded release.
- [ ] PR to airis_b2c, exact-head checks, SDD and work-item completion, private acceptance updated.

## Approach

Derive editable boolean settings and partial input contracts from the existing defaults. Reuse the existing six-section normalization and existing group read/write paths. Keep incomplete input distinct from normalized display/edit state; do not assert completeness without normalization. Preserve unknown fields and avoid any. The exported prop remains partial/nullable by section. The existing normalizer returns the complete editable shape. Template section assertions run only after that normalization and compile away. The next group/modal contract item must resolve nullable group IDs across the membership UI before changing that separate boundary.

## Upstream impact

Permissions.svelte: input/normalized annotations and erased non-null assertions at the existing six-section normalization boundary. A fork-owned type module derives editable booleans from stock defaults. No backend changes. No server permission changes for testing; use an isolated environment.

## Dependency compatibility

Repo lock pins Svelte5.56.0, TypeScript5.9.3 and i18next23.16.8. npm registry latest at inspection:5.57.1,7.0.2,26.4.2 respectively. Official Svelte legacy props and TypeScript mapped-type docs plus the pinned Svelte release were read on this continuation. Earlier inspection did not return readable official documentation; this read fills that evidence gap. This refactor introduces no integration/dependency and uses type-only features supported by the existing compiler. Preserve the tested stack; upgrades require a separate item for Svelte/compiler/i18next compatibility and full regression checks.

Primary references: https://svelte.dev/docs/svelte/legacy-export-let; https://svelte.dev/docs/svelte/typescript; https://www.typescriptlang.org/docs/handbook/2/mapped-types.html; pinned release tags in sveltejs/svelte, microsoft/TypeScript and i18next/i18next.

## Risks

A full type assigned to incomplete input can narrow compatibility or introduce new caller errors. Literal readonly defaults must not constrain editable booleans. Changes to access-control behavior are outside this refactor. G14 remains open until whole-project and product acceptance passes.

## Scope decision

The safety-net tests passed on the unmodified form. Type-checking the modal exposed a separate nullable group-ID boundary in membership controls; narrowing it or adding a fallback changes that contract. Keep the final commit focused on the 189 permission-form diagnostics. EditGroupModal retains its seven existing diagnostics for the next measured item; no partial modal fix is included. Tests cover actual switches, partial and null sections, unknown fields, serialized reloads, global-default explanations and defaults immutability.

## Verification before PR

- Compose full frontend suite: 213/213 tests in48 files passed.
- Compose check: 4442 errors/179 warnings versus4631/179; 189 removed, zero new diagnostics by file/severity/message. Permissions.svelte: zero diagnostics; existing group callers unchanged.
- Full frontend ESLint:1546 errors versus1548. Changed component/type/test/harness: zero errors or warnings. Rules/configuration/lockfiles unchanged.
- Prettier check passed for all four code/test files.
- Svelte5.56.0 production client and server output byte-identical to integration base b0a248c7e. Client SHA256032a6a0bc730ccc5f946c18812fa5400845810269540ee0ecf5bcc434f62ca80; server77d1d8af5a3ee4023f6c3f47506ec36140ddb0bd059cc4c03c21cd59889a4728. Type module is imported only with import type; tests/harness are outside production routes. No runtime image release required.
- Review: no runtime default/permission/API behavior changes, no any, no new dependencies. Existing 1194-line component is retained; template assertions erase at compile time. Backend verification not applicable to this frontend-only type change. General G14 remains open.

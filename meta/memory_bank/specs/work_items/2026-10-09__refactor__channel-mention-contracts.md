# Channel mention list contracts

## Meta

- Type: refactor
- Status: done (source scope)
- Owner: Codex
- Branch: codex/refactor/channel-mention-contracts
- SDD Spec: meta/sdd/specs/completed/airis-channel-mention-contracts-2026-10-09-014.json
- Created: 2026-10-09
- Base: origin/airis_b2c d579f5c02926cace8c8da60434ce1c39c7284361; explicit fast-forward dependency cc2cb572547fe0dcccb7a3c478ff9ed30f5ac25b.

## Goal / measurable acceptance

G14 source work: type user/model/channel suggestions with existing Model, ChannelListItem and SessionUser contracts. Preserve selection serialization, query filtering, sort, public-channel icon rules, keyboard handling and image fallback.

- [x] Remove all 9 existing MentionList type errors; no new diagnostics elsewhere.
- [x] Remove 6 local ESLint errors from unused imports/any/ts-ignore without suppressions; preserve externally supplied label/triggerChar exports (their 2 warnings remain explicit release work).
- [x] Compiled component JavaScript byte-equivalent after unused imports removed; full existing frontend tests pass.
- [x] All backend files identical; primary work and production preserved.
- [x] Own formatting/SDD valid; source committed/pushed with matching remote SHA.
- [ ] General zero-error release, same-SHA matrix, preflight/PR/integration/image/production/real A/B acceptance.

## Scope / upstream impact

Only src/lib/components/channel/MessageInput/MentionList.svelte. One local discriminated type for its existing heterogeneous list; reuse existing entity/grant contracts. No API, dependency, schema or UI change. Preserve unused public exports rather than silently changing the supplied component contract. No new test for type annotations; compiled-code equality and existing regressions provide the safety check.

## Verification / risks

Docker Compose: compiled-code equality, full frontend/check/lint multiset comparisons and own format. Search route /users/search returns UserInfoListResponse with user id/name; annotate only consumed fields at its legacy untyped API boundary. Existing Navbar public-grant type pattern applies to ChannelListItem. Removing ts-ignore must expose no diagnostic. Code review checks the whole component and its shared suggestion renderer/callers. No production mutation.

Evidence: /Users/yshishenya/.codex/private-artifacts/airis-channel-mention-contracts-20261009.

## Source acceptance — 09.10.2026

- Source01938912dc8feab3e4790ce1a5a4426d78b93288 pushed to codex/refactor/channel-mention-contracts. One source file only; no runtime dependencies, API or schema changes.
- Entire compiled component script and template byte-equal after removing3 unused import bindings; each source module remains imported, so no module side effects removed. No tests added for annotations. Existing full frontend1032/127files passed.
- Types2052→2043/108: exactly9 errors removed here; warnings unchanged;new diagnostics0. ESLint1012→1006: exactly6 removed here;new0. Two unused supplied label/triggerChar exports remain explicit general release work rather than changing the public prop contract in this type-only step.
- Source freeze1519files:1065frontend/454backend. Backend byte-equal to previous1025-pass/no-skip stage;backend/Black/Ruff not rerun;fresh full same-SHA matrix remains required for general release.
- Production11:12:29.906905UTC: c0ea9dd7823a89e21a8bd58f1e8eef6fe930b908,healthy,restarts0;image/env/config/mounts equal. Original12 neighbors unchanged;2 new running terminal containers appeared (14 total). Initial aggregate comparison failed on the additions; exact per-name comparison confirmed zero old removals/changes, recorded in production-neighbor-delta.json. This stage performed only read-only remote captures and changed none of those containers.21 protected primary files match.
- Own formatting/compiled check,diagnostic comparisons,source hashes and protected-data checks pass. SDD2/2 source tasks complete. CLI-generated four-digit own id renamed to canonical014. Shared current_tasks and other specs unchanged.
- Evidence: test-acceptance.json,tested-source-snapshot.json,compiled-equality.json,frontend-tests.log,frontend-check.log,frontend-lint.log,production-after.json,production-neighbor-delta.json. Goalactive;plan198/244;new numbered closures0. General quality/preflight/PR/integration/image/production/real A/B acceptance open.

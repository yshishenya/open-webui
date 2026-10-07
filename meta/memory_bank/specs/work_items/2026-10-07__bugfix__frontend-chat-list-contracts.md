# Chat list API contracts

## Meta

- Type: bugfix
- Status: done (implementation and local acceptance; publication pending)
- Owner: Codex
- Branch: codex/bugfix/frontend-chat-list-contracts
- SDD Spec: meta/sdd/specs/completed/airis-frontend-chat-list-contracts-2026-10-07-001.json
- Created: 2026-10-07
- Updated: 2026-10-07

## Context

Chat list APIs infer response items as any. The shared store separately assumes a list shape and casts API results. This breaks the common frontend quality gate and prevents TypeScript from checking the path from server responses to lists. Backend ChatTitleIdResponse and shared_chats.SharedChatResponse are the authoritative response shapes; folders return titles without the client time_range field.

## Goal / Acceptance Criteria

- [x] Reuse one shared list item contract; distinguish ordinary/folder responses from shared chat responses.
- [x] Type all eight title-list API paths and remove redundant store casts; preserve HTTP requests, errors, ordering, metadata and timestamp grouping.
- [x] All three changed runtime modules emit identical JavaScript after the existing bundler's TypeScript transform. No dependency, API, money or persistence change.
- [x] Full frontend suite: 861/861 in 103 files. Types: 3245 to 3234, 121 warnings unchanged, zero new normalized diagnostics. Full ESLint: 1180 unchanged; all four changed/new TS files have zero errors and clean formatting.
- [ ] Complete SDD, commit/push and accept exact-head CI before merging to airis_b2c. Global release quality remains open.

## Scope and implementation

Existing frontend-contracts and chatList store are reused. API mapping boundaries receive concrete server types. Consumers are annotated only where the newly checked API result exposes existing inferred null/never state. No general request wrapper, runtime validator or additional dependency is needed for an unchanged backend contract.

All consumers were checked by the full typecheck; no component edit was needed. Typed inference also removes four existing diagnostics from search, chat references and the administrator's chat list. The static contract rejects the original untyped API with five diagnostics and accepts the fix with zero. API type assertions describe existing validated server responses; they do not add runtime validation.

Pinned TypeScript 5.9.3, esbuild 0.25.12 and svelte-check 4.4.5 were verified from package-lock. Official TypeScript 5.9 release notes and the type-assertion handbook were read. Registry latest stable is TypeScript 7.0.2; this existing-pipeline correction retains the lockfile for reproducible SvelteKit checks. A separate compiler upgrade must read 6/7 release notes, validate SvelteKit/svelte-check compatibility and pass the whole unchanged suite. No dependency is introduced or replaced here.

## Upstream impact

src/lib/apis/chats/index.ts: type-only imports, response/return annotations at existing list paths. Consumer components, if needed: type-only state and context annotations. No reformatting or unrelated cleanup. Fork-owned frontend-contracts and chatList hold the shared contracts.

## Verification

Docker Compose using the existing frontend dependency volume: full npm run check, ESLint over the original set, full npm run test:frontend and scoped Prettier. All three bundler-transformed modules match the base byte for byte; no Svelte component changed. Raw TypeScript transpile output differs only in redundant parentheses around one await after removing its assertion; the bundler erases those parentheses in both versions. Existing list pagination/stale-response tests remain authoritative for behavior. The static API contract check fails against the untyped base and passes against the fix. No application image/deploy is needed for erased declarations.

Early checks rejected a type-equality comparison between structurally equivalent intersections and the raw-transpile parentheses difference. These are retained as failed verification attempts; final checks assert actual field types and compare the existing bundler's output. No compiler or lint rule was weakened.

## Risks / Rollback

Declared types must match each server endpoint and preserve nullable fields. Revert the commit if a declaration is incorrect. Identical emitted runtime requires no application rollout; source and CI acceptance are still required. Preserve unrelated primary checkout work and private plan files.

## Completion

- [x] SDD check-complete and complete-spec
- [x] Branch update with Spec, Owner, Summary and Done
- [ ] Exact-head publication accepted

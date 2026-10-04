# Chat history contracts

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/chat-history-contracts
- SDD Spec: meta/sdd/specs/completed/airis-chat-history-contracts-2026-10-04-002.json
- Created: 2026-10-04

## Goal / Acceptance Criteria

- [x] Main Chat history uses the existing ChatHistory contract; graph IDs and message fields remain concrete.
- [x] Empty history, branch selection, placeholders and streamed metadata type-check; invalid IDs and fields are rejected.
- [x] Complete Chat client/server JavaScript and shared module runtime remain byte identical.
- [x] All frontend tests pass; no new type/lint issues; removed diagnostics and refined wording of existing errors counted separately.
- [x] Source, evidence documentation and SDD committed and pushed for review against airis_b2c.

## Scope / Traced flow

Reuse src/lib/utils/airis/chat_history.ts. Conversion and sanitizeHistory repair graph fields on load. Chat creates user/assistant placeholders, tracks currentId/childrenIds, receives status/files/embeds/followUps/favorite/code execution and outlet/completion patches, saves graph and flat messages, and supports branching, regenerate, stop and continue. Messages already uses this contract; MessageInput/socket API/upload contracts are separate follow-ups.

Optional metadata only for existing readers/writers, with known fields concrete and provider extensions retained as unknown. The local optional state property preserves legacy history.state reads used by window.history.replaceState without changing persisted records.

## Upstream impact / Non-goals

Chat.svelte receives type annotations only; shared fork-owned chat_history.ts retains runtime helpers. No API, database, provider, billing, generation, upload or production configuration changes. No new dependencies, error suppression or formatting churn.

## Verification / Risks

Run existing history/graph/message tests and all frontend tests through the Compose-created tools container. Compare full type/lint diagnostics against accepted cf264bfb source with line mapping. Inspect changed-type wording independently. Compare whole client/server compiler output and transpiled module. Strict compiler probe checks typed state. Preserve pre-existing upstream formatting debt. Backend and migration untouched: no backend formatting/tests or production build if executable equality holds.

Narrowing history may expose optional fields or incompatible consumers. Resolve grounded shape issues; retain unrelated debt. Rollback is reverting annotations. Full onboarding goal and real pilot criteria stay active.

## Verified result

- 491/491 frontend tests pass in 73 files, including the new strict probe of the actual Chat history declaration. String/null graph IDs, branch links, placeholders and stream extensions remain concrete; numeric IDs/children/actions/suggestions and missing canonical IDs are rejected.
- Errors: 3922 -> 3848; warnings remain 164. Removed 74 diagnostics. Two existing errors at the same original lines now state the narrower issue: nullable parent ID in task cancellation, and optional parent content passed to MoA. These remain visible and unresolved; no non-null assertion or fallback introduced to hide them. No unrelated added diagnostics.
- All 1419 ESLint diagnostics remain identical, including multiline messages and rule names. Global type/style gates are still red.
- Complete client/server Chat JavaScript and transpiled history helper module are byte identical (3/3). Baseline source files match cf264bfb16cc16e7d98ecee598a9b717ff8c3217. Existing branch assertions removed where the concrete contract now covers them; runtime graph helper unchanged.
- Shared module and test formatting pass; upstream Chat formatting debt preserved. npm run preflight is absent; actual frontend tests, check and lint commands ran separately through the existing Compose-created container. Backend and migrations unchanged; no rebuild or deployment for erased types.
- Status and code execution objects retain unknown provider extension fields; only fields read here are typed. Attachments, MessageInput and socket signatures remain a separate scoped follow-up.
- Final onboarding goal/G14 and real pilot acceptance remain open. This work does not close another numbered product-plan task.

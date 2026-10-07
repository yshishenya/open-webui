# AIRIS browser history state preservation

- Type: bugfix
- Status: completed
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/browser-history-state`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-browser-history-state-2026-10-07-001.json`

## Cause and existing flow

Three native replaceState calls in Chat read history.state from message history,
not window.history. Chat history has messages/currentId, not navigation state.
They execute on new-chat reset, backend-created chat completion, and explicit
chat creation. Native replaceState overwrites SvelteKit/browser entry state.
Reuse the native window.history.state pattern already used by unsubscribe.
Compiled acceptance also reproduced a stale $page URL after in-place creation:
new-chat reset cleared the screen but retained /c/created. Read the current
window.location.pathname in the existing reset guard.

## Measurable acceptance

- [x] Reproduce loss on all three actual call sites with distinct navigation
      and message-history values; trace every source caller.
- [x] Preserve current browser state on all three calls; creation URLs and API payloads
      unchanged; reset returns to / even when router URL is stale. Explicit creation preserves state in normal mode; embedded
      and temporary modes do not change native history.
- [x] Remove invented message-history state field, type initialization/save
      from existing ChatHistory; no app-runtime casts, Any, suppressions or dependencies added.
- [x] Full frontend tests pass; zero new normalized type/lint diagnostics and
      no new formatting residue. Compiler delta limited to three state arguments and the current native URL guard.
- [x] Exact source CI and identical source/merge trees accepted.
- [x] Candidate/full path tests and guarded production release accepted,
      current image/ENV/data/neighbors preserved and immutable files verified.
- [x] SDD closed and proof linked; global G14/13.11 and A/B goal remain open.

## Scope and upstream impact

Minimal edits in Chat.svelte, plus one regression test. Existing global history
API reused; no helper/module or dependency needed. No backend, schema, mail,
quota or payment changes. Production UI overlay requires new exact source label.

## Verification and rollback

Docker Compose-first, actual handler/call evaluation and candidate browser tests.
Freeze source and current deployed base before packaging; preserve deployed
static assets/backend layers and current settings. Guarded backup/migration,
digest/disk/state checks before app-only recreate, then live hash/health checks.
Revert source and restore the prior immutable image if runtime acceptance fails.

## Accepted release — 2026-10-07

Source `939dcc02a2cf2cda141ed715f03cac49e14d5809`,
[PR329](https://github.com/yshishenya/open-webui/pull/329), merge
`4e778fcfc317b80abe3f36508c23503bf2308289`; identical source/merge trees.
18/18 targeted,818/818 full frontend,4/4 compiled browser checks and24/24 full
onboarding/payment paths passed. No new type/lint/format diagnostics.
Compiler acceptance limits runtime delta to three native state arguments and
one current native URL guard, with identical CSS.

Guarded release accepted; live image digest
`sha256:216c6ed40e433e55c145781dbbd2077b3c55d6a16814a1b96dc961e79d43479a`,
4914 frontend and427 backend file hashes matched. Current backend/static assets,
analytics, environment, original12 neighbors and money table hashes preserved.
Browser reload preserved352-character draft and GPT5.6Luna selection without
submitting generation/payment. One additional per-user terminal appeared after
reload; all original containers preserved. Image pin applied without recreate.
Health healthy, restarts0, free space11.14GiB above10GiB guard.

Existing full quality debt remains3312 type errors/130warnings and1227 ESLint
errors; G14/13.11 remains open. Global plan198/244 and full goal remain active.
Evidence manifests and private acceptance stay outside published Git content.
No independent review claimed: CodeRabbit disabled for this base branch.

# AIRIS browser history state preservation

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/browser-history-state`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-browser-history-state-2026-10-07-001.json`

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

- [ ] Reproduce loss on all three actual call sites with distinct navigation
      and message-history values; trace every source caller.
- [ ] Preserve current browser state on all three calls; creation URLs and API payloads
      unchanged; reset returns to / even when router URL is stale. Explicit creation preserves state in normal mode; embedded
      and temporary modes do not change native history.
- [ ] Remove invented message-history state field, type initialization/save
      from existing ChatHistory; no app-runtime casts, Any, suppressions or dependencies added.
- [ ] Full frontend tests pass; zero new normalized type/lint diagnostics and
      no new formatting residue. Compiler delta limited to three state arguments and the current native URL guard.
- [ ] Exact source CI and identical source/merge trees accepted.
- [ ] Candidate/full path tests and guarded production release accepted,
      current image/ENV/data/neighbors preserved and immutable files verified.
- [ ] SDD closed and proof linked; global G14/13.11 and A/B goal remain open.

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

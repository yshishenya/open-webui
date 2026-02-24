# Dev Stack Helper + Nginx Config Sync

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/refactor/dev-stack-nginx-config-sync
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-02-24
- Updated: 2026-02-24

## Context

Dev/ops local changes include:
- `scripts/dev_stack.sh` still printing backend default as `8080` while dev overlay default already moved to `8081`.
- Nginx SSL session cache zone in `airis.2brain.pro.conf` needed explicit unique name.
- New dedicated nginx vhost config for `dev.chat.airis.you` is present locally and needs tracked delivery.

## Goal / Acceptance Criteria

- [x] Dev stack helper output matches current dev backend default port.
- [x] Existing nginx prod config keeps unique SSL session cache namespace.
- [x] New dev-domain nginx vhost config is added to repository.

## Non-goals

- Deploying nginx configs to target hosts.
- Certbot/certificate provisioning changes.
- Runtime backend/frontend code changes.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - `scripts/dev_stack.sh`
  - `nginx/airis.2brain.pro.conf`
  - `nginx/dev.chat.airis.you.conf` (new)
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - `scripts/dev_stack.sh`
  - `nginx/airis.2brain.pro.conf`
  - `nginx/dev.chat.airis.you.conf`
- API changes:
  - None.
- Edge cases:
  - nginx syntax validation on this machine depends on availability of real certificate files referenced by config paths.

## Upstream impact

If this work touches upstream-owned files, list them here and explain why (and how the diff is minimized):

- Upstream-owned files touched:
  - None (fork-owned ops/config area).
- Why unavoidable:
  - N/A.
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Minimal, targeted config updates only.

## Verification

Docker Compose-first commands (adjust if needed):

- Script syntax: `bash -n scripts/dev_stack.sh`
- Nginx binary availability check: `command -v nginx`
- Manual config review for touched nginx files (paths/directives)

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [ ] **[REFACTOR][DEVOPS]** Sync dev helper and nginx config updates
  - Spec: `meta/memory_bank/specs/work_items/2026-02-24__refactor__dev-stack-nginx-config-sync.md`
  - Owner: Codex
  - Branch: `codex/refactor/dev-stack-nginx-config-sync`
  - Started: 2026-02-24
  - Summary: Align dev helper backend port output with current defaults and add/adjust nginx configs for prod/dev hostnames.
  - Tests: `bash -n scripts/dev_stack.sh`, manual nginx config review
  - Risks: Low-Medium (ops config changes require host deployment validation).

## Risks / Rollback

- Risks:
  - Incorrect nginx config deployment can impact host-level routing.
- Rollback plan:
  - Revert commit and redeploy previous nginx configs.

## Completion Checklist

- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

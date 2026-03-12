# Airis Prod User-Space VPN VLESS Activation

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/header-billing-zero-balance-visibility
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

The user asked to configure the same VPN setup on the Airis production host (`airis-prod`, `185.130.212.71`) after the current server and LiteLLM host were switched to the provided `grpc + reality` VLESS share link. On `airis-prod`, a legacy root-managed `xray.service` already occupied ports `1080/1081`, still used the old VLESS config, and required `sudo` to modify safely.

## Goal / Acceptance Criteria

- [x] Make `vpn` / `vpn-on` work on `airis-prod` with the provided VLESS link.
- [x] Avoid breaking the existing root-managed Xray service without confirmed `sudo` access.
- [x] Verify working direct vs proxy route and passing HTTP/SOCKS proxy tests.

## Non-goals

- Editing the root-owned `/usr/local/etc/xray/config.json`.
- Restarting or removing the legacy `xray.service`.
- Modifying application code in the repository.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Install a user-space Xray binary for `yan` if missing.
  - Write `~/.config/xray-airis/config.json` with the provided VLESS config.
  - Write `~/.xray-proxy.sh` for user-space proxy env.
  - Append/update a `~/.zshrc` override block so `vpn` / `vpn-on` use the user-space client on ports `2080/2081`.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - Remote `~/.local/bin/xray`
  - Remote `~/.config/xray-airis/config.json`
  - Remote `~/.xray-proxy.sh`
  - Remote `~/.zshrc`
- API changes:
  - None.
- Edge cases:
  - The legacy systemd Xray service remains on `1080/1081`; the user-space flow intentionally uses `2080/2081` to avoid conflicts without `sudo`.
  - Fresh shell sessions show `vpn` status correctly; `vpn-on` is still required to export proxy env vars into the current shell.

## Upstream impact

- Upstream-owned files touched:
  - None.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Repo changes are limited to Memory Bank tracking for this operational task.

## Verification

Docker Compose-first commands are not relevant for this shell-level operational fix.

- Remote inspect: `ssh -i ~/.ssh/airis_prod -o IdentitiesOnly=yes yan@185.130.212.71 'systemctl cat xray; sed -n "1,260p" /usr/local/etc/xray/config.json'`
- Remote install: `ssh -i ~/.ssh/airis_prod -o IdentitiesOnly=yes yan@185.130.212.71 'bash /tmp/airis_prod_user_setup.sh'`
- Runtime verification: `ssh -i ~/.ssh/airis_prod -o IdentitiesOnly=yes yan@185.130.212.71 'zsh -lic "vpn-off >/dev/null 2>&1 || true; vpn-on; echo ---; vpn; echo ---; vpn-test"'`
- Fresh-session verification: `ssh -i ~/.ssh/airis_prod -o IdentitiesOnly=yes yan@185.130.212.71 'zsh -lic "vpn"'`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][OPS][VPN]** Add user-space VLESS VPN flow on `airis-prod`
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__airis-prod-vpn-user-space-vless-activation.md`
  - Owner: Codex
  - Branch: `bugfix/header-billing-zero-balance-visibility`
  - Done: 2026-03-12
  - Summary: Added a user-space Xray client on `airis-prod` using the provided `grpc + reality` VLESS link and overrode `vpn` / `vpn-on` to use ports `2080/2081` because the legacy root service still occupies `1080/1081`.
  - Tests: Remote `vpn-on`, `vpn`, `vpn-test`, and a fresh login-shell `vpn` check on `yan@185.130.212.71`
  - Risks: Low-Medium (legacy root-managed Xray remains installed in parallel; shell helpers now target the user-space client instead)

## Risks / Rollback

- Risks:
  - The server now has both a legacy root-managed Xray service and a separate user-space Xray process.
- Rollback plan:
  - Run `vpn-off`, remove the appended `AIRIS_XRAY_USER_SETUP_AIRIS_PROD` block from `~/.zshrc`, remove `~/.config/xray-airis/config.json`, and restore the prior `~/.xray-proxy.sh` if needed.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

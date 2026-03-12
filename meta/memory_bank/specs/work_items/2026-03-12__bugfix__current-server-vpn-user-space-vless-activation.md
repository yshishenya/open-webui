# Current Server User-Space VPN VLESS Activation

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/header-billing-zero-balance-visibility
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

After the LiteLLM host was fixed, the user reported that `vpn` / `vpn-on` still failed on the current server (`37000.example.us`). The shell was still using the old privileged `systemctl start xray` wrapper even though no `xray.service` existed.

## Goal / Acceptance Criteria

- [x] Replace the current server's old `systemctl`-based `vpn` wrapper with the same user-space Xray approach used on the LiteLLM host.
- [x] Configure the current server with the provided `grpc + reality` VLESS link.
- [x] Verify that `vpn-on` works in a fresh login shell and that proxy egress differs from the direct server IP.

## Non-goals

- Installing a privileged systemd service.
- Modifying project application code.
- Enabling VPN autostart on shell startup.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Install local user-space Xray binary under `~/.local/bin/xray`.
  - Write `~/.config/xray/config.json` for the provided VLESS endpoint.
  - Write `~/.xray-proxy.sh`.
  - Append/update a `~/.zshrc` override block for `vpn`, `vpn-on`, `vpn-off`, `vpn-test`.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - Local `~/.local/bin/xray`
  - Local `~/.config/xray/config.json`
  - Local `~/.xray-proxy.sh`
  - Local `~/.zshrc`
- API changes:
  - None.
- Edge cases:
  - Existing open shell sessions still hold the old function definitions until `exec zsh` or `source ~/.zshrc`.
  - The helper is user-space only; a fresh shell shows `VPN route inactive` until the user explicitly runs `vpn-on`.

## Upstream impact

- Upstream-owned files touched:
  - None.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Repo changes are limited to Memory Bank task tracking.

## Verification

Docker Compose-first commands are not relevant for this shell-level operational fix.

- Local install/update: `/tmp/local_setup_xray_user.sh`
- Runtime verification: `zsh -lic 'vpn-off >/dev/null 2>&1 || true; vpn-on; echo ---; vpn; echo ---; vpn-test'`
- Fresh-session verification: `zsh -lic 'vpn'`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][OPS][VPN]** Replace current server `systemctl` VPN wrapper with user-space Xray
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__current-server-vpn-user-space-vless-activation.md`
  - Owner: Codex
  - Branch: `bugfix/header-billing-zero-balance-visibility`
  - Done: 2026-03-12
  - Summary: Installed user-space Xray with the provided `grpc + reality` VLESS config on the current server and replaced the broken `systemctl xray` shell wrappers with the same `vpn` UX used on LiteLLM.
  - Tests: Local `vpn-on`, `vpn`, `vpn-test`, plus a fresh login-shell `vpn` check
  - Risks: Low-Medium (existing open terminals keep old function definitions until shell reload)

## Risks / Rollback

- Risks:
  - Existing terminals keep the old `vpn` functions in memory until reloaded.
- Rollback plan:
  - Run `vpn-off`, restore the previous `~/.config/xray/config.json`, `~/.xray-proxy.sh`, and remove the appended `AIRIS_XRAY_USER_SETUP_V2` block from `~/.zshrc`.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

# LiteLLM User-Space VPN VLESS Update

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: bugfix/header-billing-zero-balance-visibility
- SDD Spec (JSON, required for non-trivial): N/A
- Created: 2026-03-12
- Updated: 2026-03-12

## Context

The LiteLLM host had shell helpers `vpn` / `vpn-on`, but no working privileged `xray.service`, and the available `sudo` password did not work. The host still needed the same VLESS-based VPN access pattern as this server, now updated to the user-provided `grpc + reality` share link.

## Goal / Acceptance Criteria

- [x] Configure the LiteLLM host with the provided VLESS share link in a working Xray client config.
- [x] Keep `vpn` / `vpn-on` usable for the `yan` user without requiring `sudo`.
- [x] Verify that the host exposes local proxy ports and that proxied egress differs from the direct server IP.

## Non-goals

- Installing a privileged systemd service.
- Changing repository application code.
- Automating VPN autostart outside the existing shell workflow.

## Scope (what changes)

- Backend:
  - None.
- Frontend:
  - None.
- Config/Env:
  - Update LiteLLM host `~/.config/xray/config.json` with the provided VLESS parameters.
  - Refresh `~/.xray-proxy.sh`.
  - Append a new `~/.zshrc` override block so `vpn` status no longer depends on a hardcoded egress IP.
- Data model / migrations:
  - None.

## Implementation Notes

- Key files/entrypoints:
  - Remote host `~/.config/xray/config.json`
  - Remote host `~/.xray-proxy.sh`
  - Remote host `~/.zshrc`
- API changes:
  - None.
- Edge cases:
  - The remote host had no working `sudo`, so the solution uses the previously installed user-space Xray binary and a detached user-level process.
  - `vpn-status` now reports both direct and proxy IPs instead of matching against a specific country egress IP.

## Upstream impact

- Upstream-owned files touched:
  - None.
- Why unavoidable:
  - N/A
- Minimization strategy (thin hooks / additive modules / guarded behavior):
  - Repo changes are limited to Memory Bank task tracking only.

## Verification

Docker Compose-first commands are not relevant for this server-side shell fix.

- Remote install/update: `ssh yan@142.252.220.116 'install -d ~/.config/xray && cat > ~/.config/xray/config.json' < /tmp/litellm_xray_config.json`
- Remote helper refresh: `ssh yan@142.252.220.116 'cat > ~/.xray-proxy.sh' < /tmp/litellm_xray_proxy.sh`
- Remote shell override: `ssh yan@142.252.220.116 'cat >> ~/.zshrc' < /tmp/litellm_vpn_override.zsh`
- Runtime verification: `ssh yan@142.252.220.116 'zsh -lic "vpn-off >/dev/null 2>&1 || true; vpn-on; echo ---; vpn; echo ---; vpn-test"'`
- Fresh-session verification: `ssh yan@142.252.220.116 'zsh -lic "vpn"'`

## Task Entry (for branch_updates/current_tasks)

Use this snippet in `meta/memory_bank/branch_updates/<YYYY-MM-DD>-<branch-slug>.md` and later in `meta/memory_bank/current_tasks.md`:

- [x] **[BUG][OPS][VPN]** Restore working LiteLLM VPN commands with user-space Xray
  - Spec: `meta/memory_bank/specs/work_items/2026-03-12__bugfix__litellm-vpn-user-space-vless-update.md`
  - Owner: Codex
  - Branch: `bugfix/header-billing-zero-balance-visibility`
  - Done: 2026-03-12
  - Summary: Updated the LiteLLM host to use the provided `grpc + reality` VLESS config through the existing user-space Xray client and refreshed `vpn` / `vpn-on` so they show direct vs proxy route correctly without `sudo`.
  - Tests: Remote `vpn-on`, `vpn`, `vpn-test`, and a fresh login-shell `vpn` check on `yan@142.252.220.116`
  - Risks: Low-Medium (remote shell override now contains two generations of VPN helpers; latest block wins and was verified live)

## Risks / Rollback

- Risks:
  - The remote `~/.zshrc` now contains both the original user-space helper block and a later override block.
- Rollback plan:
  - Run `vpn-off` on the LiteLLM host and restore the previous `~/.config/xray/config.json`, `~/.xray-proxy.sh`, and `~/.zshrc` from shell history or backup copy if needed.

## Completion Checklist

- [x] If SDD spec is linked: `meta/tools/sdd check-complete <spec_id> --json`
- [x] If SDD spec is linked: `meta/tools/sdd complete-spec <spec_id> --json`
- [x] Branch update entry moved to `Done` with required fields (`Spec`, `Owner`, `Summary`, `Done`)

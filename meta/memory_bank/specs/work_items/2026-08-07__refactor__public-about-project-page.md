# Public page: honest project page

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: codex/feature/billing-balance-history-simplify
- Created: 2026-08-07
- Updated: 2026-08-07

## Context

The `/about` page used company language and unsupported values despite Airis being presented as a product/project. That creates a misleading expectation and adds a low-value navigation destination.

## Goal

Make `/about` a concise, factual page about the Airis project and rename its public navigation label to `О проекте`.

## Scope

- Replace company/mission/values copy with a factual product explanation, three-step usage model, and capability caveat.
- Keep `/about` as a compatibility URL for existing links.
- Rename the shared header and footer labels.
- Do not add backend APIs, dependencies, or invented company/team claims.

## Verification

- `git diff --check`
- Targeted frontend lint for the changed Svelte files.
- Production route smoke for `/about` after deployment.

## Risks / Rollback

- Risk: copy change affects SEO/navigation expectations.
- Rollback: revert the route copy and two shared labels; URL remains stable.

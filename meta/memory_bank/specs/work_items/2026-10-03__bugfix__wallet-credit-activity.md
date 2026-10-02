# Refresh recent wallet activity after confirmed top-up

## Meta

- Type: bugfix
- Status: completed (implementation, candidate acceptance and production verification)
- Owner: Codex
- Branch: `codex/bugfix/wallet-credit-activity`
- SDD Spec: `meta/sdd/specs/completed/airis-wallet-credit-activity-2026-10-03-001.json`
- Created: 2026-10-03
- Updated: 2026-10-03

## Context

Returning from a successful payment updates the wallet balance and shows the success banner, but Latest activity retains the ledger loaded before reconciliation. Opening full History shows the new entry. UnifiedTimeline loads on mount while wallet return checks update only the balance.

## Goal / Acceptance Criteria

- [x] Reproduce stale recent activity with a component test before changing runtime code.
- [x] Automatic return polling and manual Refresh show the confirmed top-up without navigation or page reload.
- [x] Pending or failed reconciliation preserves current activity and never shows payment success.
- [x] Refresh uses the existing ledger/usage APIs; no client-synthesized transaction or balance-inferred credit.
- [x] Run full frontend tests and strict checks; retain documented existing failures without weakening rules.

## Scope / Implementation Notes

Increment a wallet-local timeline revision only when the shared reconciliation function returns credited=true. Key the small recent-activity component by that revision to reload authoritative ledger/usage data. Both manual and polling paths share this function; financial APIs, payment processing and full History stay unchanged.

No new dependencies, environment settings, schema or backend changes. Existing Svelte key-block semantics are documented at https://svelte.dev/docs/svelte/key. Dependencies remain repo-pinned; framework upgrade is a separate compatibility task.

## Upstream impact

- `src/routes/(app)/billing/balance/+page.svelte`: narrow revision state, reconciliation hook and keyed wrapper around the existing recent-activity component.
- `src/routes/(app)/billing/balance/billing-balance.test.ts`: user-visible regressions using the real timeline component.
- No shared timeline contract or unrelated formatting changes.

## Verification

Docker Compose frontend tests, `npm run check`, `npm run lint:frontend`, focused strict lint and formatting for changed files. Backend checks already cover the unchanged backend; CI and exact source identity are recorded separately. Candidate return acceptance follows before production rollout.

## Risks / Rollback

A confirmed top-up triggers one additional ledger/usage fetch and briefly reloads the small recent list. A failed history request must remain an explicit history error and must not change payment success. Rollback the frontend image if the candidate/live return path fails; no database downgrade.

### Recorded results (2026-10-03)

- Before fix: automatic/manual credit assertions failed; 14 passed / 2 failed.
- After fix: 16 wallet tests and all 202 frontend tests in 46 files passed in Compose.
- Focused ESLint passed for both changed source files; test file formatting passed. Existing unrelated page formatting retained to keep upstream diff minimal.
- Full strict check remains at 4,668 errors / 215 warnings; full frontend lint at 1,600 errors, zero warnings. Changed files have no lint findings. No rule or baseline was weakened.
- Backend code and financial APIs are unchanged. Candidate and production acceptance remain separate release gates.

## Release acceptance

- PR #185 merged into `airis_b2c`: source `ecceff314164a0ad78fa2d8b042c741bba0efcce`, merge `a1e4c0929dd914371d807004761f393b22b1d21f`.
- Ten CI checks succeeded for that source, including billing-confidence; dependency-review was skipped. CodeRabbit reported review skipped, not an independent review.
- Immutable linux/amd64 frontend overlay passed file comparison: 5,757 frontend files matched the frozen build, all 477 backend files unchanged from the base candidate, Pyodide retained.
- The exact candidate passed real YooKassa test checkout and ordinary return: the wallet showed 1,500 RUB and all three distinct top-ups immediately without another navigation/reload. Before diagnostic replay the API confirmed 150,000 kopeks / three ledger entries. Three repeated reconciliations kept those totals; three accepted mail jobs had one attempt each, with three distinct SMTP captures. The third test receipt succeeded.
- Real funds and external email were not used. Test receipt registration does not prove a real fiscal receipt. Provider webhook delivery and the final cancellation path remain separate acceptance items.
- Production registry digest: `sha256:3b416854c00fbbfb61b75a66a60240e68368c38e4a1bb3a05e0dc47fcea89c96`; image config ID: `sha256:95283050b5f0720aefedc4cef9f9972872108a0f8488691eddf80766e3349146`.
- Guarded rollout verified fresh readable backups/checksums, retained the previous image, passed the hard Alembic gate (`q1c020261002`), recreated only the application and persisted its image selector.
- Live verification matched all 5,757 frontend hashes and 476 immutable backend hashes. The runtime-generated site manifest matched the verified frontend copy. Environment, mounts, networks, ports, command and thirteen neighboring container IDs were preserved; restart count zero; free space exceeded 12 GiB.
- Public health/version and the ordinary logged-in wallet passed. A transient 502 was observed during recreation and recovered after startup; no claim of uninterrupted availability.
- The full G14 / plan 13.11 remains open because strict project-wide type/lint debt and broader product acceptance are not closed by this release.

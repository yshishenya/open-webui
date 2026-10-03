# AIRIS measured paid guide example

## Meta

- Type: feature
- Status: completed
- Owner: Codex
- Branch: codex/feature/paid-guide-example
- SDD Spec: meta/sdd/specs/completed/airis-measured-paid-guide-example-2026-10-03-544.json
- Created: 2026-10-03

## Context

The first-task guide explains wallet use but has no measured comparison or date for pricing conditions. Publish evidence for one broad-audience planning task, with actual outputs and usage, without claiming that a higher priced model always performs better. Disabled image models remain outside the example.

## Acceptance

- [x] Use identical fresh-chat input and predeclared constraints for the free-default and an available paid text model.
- [x] Bound provider requests and output length; actual provider usage must match isolated test-wallet usage/ledger calculations.
- [x] Evaluate arithmetic, constraints and unsupported facts before writing the comparison. If no benefit is observed, report that result and do not imply superiority.
- [x] Guide displays the checked example, limitations, current top-up amounts and date of fetched pricing conditions; unavailable API does not produce a false freshness date.
- [x] Preserve the three free examples and explicit model choice without autosend or hidden paid fallback.
- [x] Exact-source CI, frozen-image release, ordinary-account acceptance and recorded rollback evidence.

## Scope

Reuse existing guide, public billing APIs, chat handlers, model access and pricing service. Provider comparison is isolated with a YooKassa test-wallet balance and SMTP capture. No production balance, grant, rate, provider or consent changes. No dependencies or migrations. Actual provider inference may incur bounded service use; test-wallet charges do not prove a real payment or fiscal receipt.

## Upstream impact

Guide is fork-owned. Keep examples and pricing presentation there, with narrow API type reuse if needed. Operational scripts and private transcripts stay outside public Git.

## Verification

Match actual model outputs to declared task constraints and provider usage to recorded usage/cost. Run appropriate Docker Compose frontend tests/type/lint and guide browser scenarios; retain existing global diagnostics. Freeze immutable build, verify live file hashes/configs/neighbor services and user-visible guide at desktop/narrow widths. A physical phone and independent usefulness assessment remain separate overall criteria.

## Risks / rollback

Do not turn a single comparison into a universal superiority claim. Keep unknown pricing/usage explicit. Rollback to the healthy previous immutable image; no data migration. Release only with the existing disk-space and backup gates.

## Measured result (2026-10-03)

One real ordinary-user HTTP request per model on the isolated current production image. Identical 376 input tokens, same system instructions, fresh chats, max2000 completion tokens, reasoning effort low. Luna1065 output tokens: input3 +output39 =42kopeks. Sol1276 output tokens: input57 +output1149 =1206kopeks. Both stopped normally; no estimated usage. Wallet150000→148752kopeks, aggregate hold/release/charge delta1248, two charge records have matching input/output components and request references, daily spent1248/reserved0. Real provider inference; YooKassa test-wallet; no real-payment/fiscal-receipt claim. Restricted provider configuration disabled and keys cleared after comparison; exported secret file removed.

Both answers detect135>120 Thursday and480+30>480 overall, propose agreed Thursday150min. Sol explicitly separates work120/120/105/135 and reserve0/0/15/15 in the final schedule; Luna's final list is less explicit about work vs capacity. Both solve the fundamental task. This observed clarity difference supports the example; independent human usefulness and universal model superiority are not established.

Frontend236tests pass. Normalized full type diagnostics match previous baseline exactly:4419errors/177warnings,0added/removed, guide0. ESLint changed files0, existing full1540. No backend or dependency changes; the application measurement used immutable deployed backend code with preserved production rate snapshots. No new libraries or integrations. Reuse locked Svelte5.56.0/SvelteKit2.68.0/Playwright1.62.1; compatibility verified by the successful build and tests. No release-note review is asserted.

Artifacts: private `airis-paid-guide-example-20261003/{comparison-protocol,comparison-acceptance,assessment,quality-comparison}.json`. Public comparison JSON contains only the generic prompt, answers, token counts and pricing conditions; no users, session tokens or provider credentials.

## Production acceptance (2026-10-03)

PR195 merged into airis_b2c. Application source e4ba3733850eda34615af4c5d1d1f428f368ce98; merge3bc2a978bf214ea59abe67d6e3a1cb652948f46e. All executed required CI passed on the exact source. Dependency review skipped; automated CodeRabbit review did not run for this base branch; neither is claimed as an independent review.

Frozen linux/amd64 image digest sha256:9037a4a24666d5b6c8f8d692c955fdc4818989b806f3841c640906116d1b4469,126layers. Twelve guide browser scenarios passed, including320/390/768/1440widths and API error/empty/invalid results. Guarded deployment retained the verified backup, rollback image and10GiB floor. Accepted5759frontend and478immutable backend file hashes, preserved runtime settings and14neighbor container IDs; restarts0, Alembicq1c020261002. Published guide accepted with an ordinary signed-in account;390px view has no horizontal overflow.

Only plan10.11/10.13 are completed by this release. Physical phone, independent usefulness, real payment/fiscal receipt, external inbox/support access and calendar pilot remain separate open conditions. Private artifacts: airis-paid-guide-example-20261003.

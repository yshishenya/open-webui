# Grouped email links release acceptance

Status: Done
Owner: Codex
Branch: `codex/docs/email-group-links-acceptance`
Implementation Spec: [Grouped links](2026-10-02__feature__email-group-links.md)
SDD Spec: `meta/sdd/specs/completed/airis-grouped-email-links-2026-10-02-204.json`

## Measurable result

- [x] PR154 merged as `291006757ecd868c1dccdc6924d0ca7b0512c3b6`; observed required CI satisfied on feature source `2a8f89ddbffea515b47451978eb9acebec914ceb`.
- [x] Frozen integration source `15aba5209bca01cefa628f918b08dadad6955f70` includes independently accepted PR153 analytics. Backend/config match the feature; the retained frontend marker is `23176a55c96f62a3191f2eb4afeac63097b6b465`.
- [x] Exact image:614 backend checks passed/3 PostgreSQL-only skips; PostgreSQL mail/report90 passed. Combined frontend35 files/156 tests passed. Source Black/Ruff/Prettier checks passed.
- [x] Candidate and previous accepted image preserve71 business tables/15315 rows on the same fresh database copy. No schema, financial, dependency or configuration change.
- [x] Guarded release verified backup checksums/readability, migration head, minimum10 GiB disk, healthy app and retained rollback. Environment, volumes, ports, networks, command and15 neighboring container IDs unchanged.
- [x] Production416 backend and7262 frontend hashes match the frozen manifest. Public health is healthy; retained frontend matches the analytics release.
- [x] Six synthetic contexts on deployed code generate36 safe navigation URLs; query filters/fragments remain. Twelve shipped template formats render, with grouped fields on displayed navigation links. Feedback uses the support reply when configured and needs no navigation link. Context checks mock data and call neither production persistence nor SMTP.
- [x] Only shared source/medium/type/template-version labels are added. No user/address/payment/job identifier, sign-in token or individual click endpoint. Optional delivery remains disabled.
- [ ] Final product acceptance: general frontend type/lint baseline, human visual/payment acceptance, actual pilot and real24h/72h/14-day windows. Unit checks do not replace them.

Image: `yshishenya/yshishenya:email-groups-15aba5209-on-analytics-20261002`.
Registry/runtime digest: `sha256:f715d5d6407497a8677c0e1a4b5560fafe974405b1a0524ac3699f41b7160ca2`.

## Upstream impact and rollback

Fork-owned context and documentation only; no additional upstream-owned runtime file changes. Restore the previously accepted compatible image if needed, preserving database and queue state. The image overlays only the grouped-link module on the accepted analytics image; analytics behavior and its independent preference handling remain intact. Group labels do not establish causal attribution or an authenticated return.

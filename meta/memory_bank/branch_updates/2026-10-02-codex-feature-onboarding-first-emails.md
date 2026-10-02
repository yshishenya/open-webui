# First onboarding emails

Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__onboarding-first-emails.md`

Status: In Progress

Start from merged queue acceptance. Trace all registration/account/verified-address/consent boundaries before templates and enabling. Reuse the released queue and existing guide task anchors. Identified missing Auth in VK and unsafe browser-data fallbacks in VK ID; no runtime edits until contract review and root-cause design are complete. Queue/pilot remains disabled.

- [ ] First onboarding emails and social lifecycle
  - Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__onboarding-first-emails.md`
  - Owner: Codex
  - Started: 2026-10-02
  - Summary: Versioned welcome/reminder reuse the public guide; provider-only VK identity, common credentials, explicit social address verification and disabled-account protection are implemented. Existing OAuth stages were separated to satisfy unchanged CI lint rules.
  - Tests: Compose backend 567 passed/3 PG-only skips; PostgreSQL first-email/queue 43 passed; touched-file Ruff passes. Final complete/image/live checks pending.
  - Risks: Social email collision now requires the original account login; contact email alone no longer attaches a provider. Product flags stay off until controlled acceptance and cohort reporting.

- 2026-10-02: OAuth security scan blocked release with ten raw-data logging findings. Remove provider payloads/errors from logs and redirects; add a regression check that fails against the previous image. Supersede the initial source/image; repeat required checks. Queue flags remain off.

- Repeat scan reduced findings to one provider-metadata error log. That path now records only the failed operation; the marker regression covers provider names and metadata errors as well. Required frozen-source checks repeat before release.

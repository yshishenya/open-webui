# Reproducible onboarding verification environment

## Meta

- Type: docs / verification
- Status: done — preparation verified; integration acceptance separate.
- Workflow: code_review
- Owner: Codex
- Branch: `codex/docs/onboarding-test-environment`
- SDD Spec: N/A — document and verify existing fixtures, with no new implementation.

## Goal and measurable acceptance

Verify preparation of plan item 00.08 without substituting local provider
responses for real provider testing or a physical device.

- [x] Disposable PostgreSQL and the accepted compiled AIRIS image boot through
      the existing guarded test wrapper, with no production mounts or host ports.
- [x] Both configured browsers pass the existing guide, quota, payment recovery,
      history and SMTP capture scenarios; ordinary signup/verification creates
      distinct accounts and preserves admin separation.
- [x] Existing email, VKID and Yandex registration regressions use real
      application boundaries with explicitly controlled provider responses.
- [x] Existing clock fixtures verify exact timing without changing physical time.
- [x] A fresh GET /v3/me confirms the separately configured YooKassa test shop
      has test=true. No new payment, refund, receipt or external mail.
- [x] The guide gives repeatable commands, setup boundaries and evidence limits;
      the pilot instructions use accepted welcome time consistently with runtime.

## Scope and upstream impact

Add one guide and task documents; correct one timestamp name in the existing
pilot guide. Reuse Compose, Playwright, PostgreSQL, SMTP capture and domain
clock fixtures. No application, dependency, migration or runtime configuration
changes. No upstream-owned files touched.

## Verification and limits

Run existing two-browser full paths on isolated PostgreSQL against the accepted
image. Reuse the latest frozen 140-case backend proof for unchanged fixtures,
including registration, controlled provider claims and clock boundaries.
Record source/lockfile hashes, image identity, exact documentation CI and
production identity separately. A narrow browser viewport is not a phone;
provider test mode is not real money or fiscal registration. Item 07.01 and
the real pilot retain their own acceptance.

## Risks / rollback

Documentation only. Revert the documentation commit if necessary; stop only
this task's disposable containers. Keep shared networks, volumes, private
credentials, proof files and unrelated primary checkout changes.

## Results

Fresh PostgreSQL/Chromium/Firefox:24/24, zero failures/skips/page errors;
compiled image healthy/restarts0. Nine fixture/config/lockfile hashes match
before and after. The unchanged backend fixtures retain the accepted140/140
PostgreSQL proof, including email/VKID/Yandex and controlled clocks.

Fresh actual test-shop GET returned200/test=true/fiscalization_enabled=true,
with zero provider mutations. Separate past real test.wallet checkout proof
is preserved as historical evidence; the new browser run uses local provider
responses. No new real payments, refunds, receipts or external mail.

The guide records all commands and differences between automated local
protocols, actual provider test mode, physical devices and voluntary pilot.
Pilot24h instructions now use accepted_at, matching the existing shared
activation rule. A report-path environment override took priority over the
custom Playwright reporter path; the generated24-case XML was copied byte
for byte from its original output, with SHA256 preserved.

Guide: [onboarding_test_environment.md](../../guides/onboarding_test_environment.md).
Exact documentation CI and source/merge equality are required before closing
private plan00.08. No application rollout needed.

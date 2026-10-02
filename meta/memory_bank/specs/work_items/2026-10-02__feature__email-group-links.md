# Grouped campaign links in onboarding email

Status: In Progress
Owner: Codex
Branch: `codex/feature/email-group-links`
SDD Spec: `meta/sdd/specs/active/airis-grouped-email-links-2026-10-02-204.json`

## Goal and scope

Complete the existing plan's grouped email-source requirement without individual click attribution. The shared onboarding context already restricts every destination to AIRIS. Append fixed source/medium and the queue's server-owned type/template version to its six navigation links, preserving existing query filters and fragments. Reuse urllib and existing consent-aware funnel capture; do not introduce a tracking endpoint or delivery click token.

## Measurable acceptance

- [x] All six queued email types produce grouped campaign metadata; no user/email/payment/job identifier in navigation links.
- [x] Existing history filter and guide/pricing anchors survive; destinations remain HTTPS AIRIS.
- [x] HTML/plain-text templates remain usable and current permission/content checks stay unchanged.
- [ ] Existing backend and PostgreSQL suites, format/lint/CI pass; frozen image and guarded live acceptance follow before enabling any pilot.
- [x] External analytics remain governed by the existing separate consent. A click is neither an authenticated return nor proof of causality.

## Upstream impact and rollback

Fork-owned email context, existing test file and documentation only. No dependency, schema, frontend, API or server-control changes. Restore the previous compatible image to remove campaign parameters; preserve queue/daily counters and optional-mail disabled controls.

## Source verification

The regression failed before the change (missing four campaign fields) and passes after it. Compose full backend614 passed/3 PostgreSQL-only skips; PostgreSQL mail/report suites90 passed; touched-file Black/Ruff passed. Frozen image, required CI and live release remain pending.

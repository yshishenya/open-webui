# AIRIS first-email release acceptance

Status: Done
Owner: Codex
Implementation Spec: `meta/memory_bank/specs/work_items/2026-10-02__feature__onboarding-first-emails.md`
SDD Spec: `meta/sdd/specs/completed/airis-first-onboarding-emails-2026-10-02-645.json`

Record exact-source verification and controlled production acceptance after PR143. No runtime changes in this documentation branch.

- [x] Freeze source, required CI, image checks and database-copy rollback compatibility.
- [x] Guarded release, healthy runtime and source/resource correspondence.
- [x] Actual worker control: one welcome, expected headers, safe repeated one-click unsubscribe and later optional suppression.
- [x] Complete the bounded SDD and retain calendar/human/pilot acceptance as separate open gates.
- [x] Exclude private evidence, recipients, server paths and operational configuration from public Git.

Validation: SDD validation/completion, targeted existing Prettier and git diff checks. Runtime validation belongs to source `4231d59f6f4fa0f0b90f510cf5450bbca624eaf3`; see implementation spec. No backend/frontend/schema change; no new tests required for this evidence-only update. No upstream-owned runtime files touched.

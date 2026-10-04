# Record accepted onboarding paths

## Meta

- Type: docs / code review
- Status: done; exact documentation CI and integration tracked separately
- Owner: Codex
- Branch: codex/docs/onboarding-paths-acceptance
- SDD Spec: N/A — documentation follow-up; implementation SDD is completed
- Created: 2026-10-04

## Context and result

Record the source, accepted artifact and production behavior of PR245 after the guarded rollout. The implementation receipt must identify the final r1 artifact and preserve the distinction between controlled external protocols, live navigation and real customer/pilot acceptance.

Implementation: [complete onboarding paths](2026-10-04__test__onboarding-full-paths.md). Previous audit: [mandatory scenarios](2026-10-04__docs__mandatory-scenario-audit.md). The two automated browser gaps recorded in that historical audit are now covered by `e2e/onboarding-paths.spec.ts`; the overall quality gate and real pilot remain open.

## Acceptance

- [x] Record PR245 exact source/head/merge and final r1 identities.
- [x] Record repeated r1 browser checks, production file equality, analytics preservation, guarded rollout and persisted default image.
- [x] Record desktop and narrow production return navigation without new generation or payment.
- [x] Preserve general quality debt, collapsed desktop rail defect and real-world acceptance limits.
- [x] Keep private operational evidence and customer details outside the public repository.

## Verification and upstream impact

Documentation only; no runtime, dependency, configuration or migration source changes. Validate changed Markdown formatting, `git diff --check` and existing completed SDD. Production acceptance and test counts are recorded in the linked implementation receipt. `npm run preflight` is absent; full frontend type/style checks retain the documented baseline. Source checks for the documentation head are required before integration.

Only fork-owned work item documents and a branch update change. No upstream impact or additional deployment.

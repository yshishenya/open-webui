# AIRIS asynchronous funnel test completion

- Type: bugfix
- Status: active
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/funnel-async-tests`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/active/airis-funnel-test-completion-2026-10-07-001.json`

## Cause

The existing test helper sleeps25ms after queued analytics operations. Provider
identity and response parsing can legitimately take longer. A60ms client-ID
provider reproduces a false failure. Signup timestamps also depend on real
seconds across asynchronous imports. Application code already exposes event
completion promises and identity callbacks; reuse them without runtime hooks.

## Measurable acceptance

- [ ] Reproduce the race without changing runtime code.
- [ ] Replace arbitrary sleep with awaited event results and completed identity
      observations; drain duplicate/suppressed signup paths with an allowed event.
- [ ] Fix the signup scenario clock using an existing Date spy; keep all privacy,
      event-count and deduplication assertions.
- [ ] Original11 cases and a slow-provider variant pass; full818 frontend tests
      pass; modified test passes formatting and ESLint.
- [ ] Exact source CI passes; runtime diff is empty, no deploy needed.
- [ ] Close3/3 SDD and link evidence; globalG14 and goal remain open.

## Upstream impact

Only fork-owned funnelAnalytics.test.ts and task documents change. Runtime,
public contracts, dependencies and provider settings are unchanged.

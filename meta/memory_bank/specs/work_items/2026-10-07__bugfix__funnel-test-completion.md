# AIRIS asynchronous funnel test completion

- Type: bugfix
- Status: completed
- Workflow: bug_fix
- Owner: Codex
- Branch: `codex/bugfix/funnel-async-tests`
- Created: 2026-10-07
- SDD Spec: `meta/sdd/specs/completed/airis-funnel-test-completion-2026-10-07-001.json`

## Cause

The existing test helper sleeps25ms after queued analytics operations. Provider
identity and response parsing can legitimately take longer. A60ms client-ID
provider reproduces a false failure. Signup timestamps also depend on real
seconds across asynchronous imports. Application code already exposes event
completion promises and identity callbacks; reuse them without runtime hooks.

## Measurable acceptance

- [x] Reproduce the race without changing runtime code.
- [x] Replace arbitrary sleep with awaited event results and completed identity
      observations; drain duplicate/suppressed signup paths with an allowed event.
- [x] Fix the signup scenario clock using an existing Date spy; keep all privacy,
      event-count and deduplication assertions.
- [x] Original11 cases and a slow-provider variant pass; full818 frontend tests
      pass; modified test passes formatting and ESLint.
- [x] Exact source CI passes; runtime diff is empty, no deploy needed.
- [x] Close3/3 SDD and link evidence; globalG14 and goal remain open.

## Upstream impact

Only fork-owned funnelAnalytics.test.ts and task documents change. Runtime,
public contracts, dependencies and provider settings are unchanged.

## Accepted source

[PR331](https://github.com/yshishenya/open-webui/pull/331), source `554ec6eb0d0c09bdec06d6eab36d0de209b58073`, merge `8533009b4917b7d6caab4749e224192c34966127`; source/merge trees identical. Ten applicable CI checks passed; dependency-review skipped; CodeRabbit disabled, no independent review claimed. Slow-provider11/11 and full818/818 passed. All3442 normalized type diagnostics identical; modified-test lint/format clean. Runtime unchanged, no deploy needed. SDD3/3 closed; globalG14 and goal remain active at198/244.

### Completed

- [x] **[ANALYTICS][LANDING][DEPLOY]** Make the lead funnel measurable and ensure production embeds analytics IDs
  - Spec: `meta/memory_bank/specs/work_items/2026-08-08__feature__analytics-lead-funnel.md`
  - Owner: Codex
  - Branch: `codex/analytics-lead-funnel`
  - Started: 2026-08-08
  - Summary: Fix missing production Metrica build ID, preserve campaign attribution, normalize funnel goals, and verify the signup-to-first-chat path in production.
  - Tests: Targeted Vitest (4/4), targeted ESLint, Docker build, production Playwright smoke, public route/API smoke, remote health and architecture checks. Full `npm run check` and repo-wide ESLint remain baseline failures in unrelated upstream files.
  - Production: `yshishenya/yshishenya:57a89fe78`, `linux/amd64`, container healthy; `/health` and all public routes/APIs return 200.
  - Analytics evidence: consented browser loads `https://mc.yandex.ru/metrika/tag.js?id=111392024`, stores bounded UTM attribution, queues CTA/auth/signup goals; denied browser loads no provider script. Direct Yandex request succeeds from production host; local browser network blocks Yandex, so delivery was verified by queue plus server-side reachability.
  - Risks: Medium; analytics-only changes plus deploy build args, no billing logic changes. Paid traffic should start as a controlled cohort until real conversion volume accumulates.

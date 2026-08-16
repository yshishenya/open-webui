### Done

- [x] **[SEO]** Add IndexNow submission and truthful sitemap freshness
  - Spec: `meta/memory_bank/specs/work_items/2026-08-16__refactor__seo-indexnow-sitemap.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Done: 2026-08-16
  - Summary: Add a public IndexNow key, a standard-library submission script, and `lastmod` only for the updated `/welcome` URL.
  - Tests: `bash -n scripts/submit_indexnow.sh`, local sitemap/key validation, live key/sitemap check, and IndexNow HTTP 202 for 14 URLs.

- [x] **[SEO][SECURITY]** Add a safe HSTS default without changing landing copy
  - Spec: `meta/memory_bank/specs/work_items/2026-08-16__refactor__welcome-seo-hsts.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Done: 2026-08-16
  - Summary: Add `max-age=31536000;includeSubDomains` through the existing application security-header middleware; leave CSP disabled pending compatibility validation.
  - Tests: Live HSTS header, `/health`, and forbidden long SEO marker checks passed.

- [x] **[SEO]** Raise `/welcome` SEO score
  - Spec: `meta/memory_bank/specs/work_items/2026-08-16__refactor__welcome-seo-score.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Done: 2026-08-16
  - Summary: Improved landing-page metadata, structured data, crawler guidance, llms.txt, image delivery, and factual content.
  - Tests: `npm run test:frontend`, targeted ESLint, `npm run build:vite` with 8 GB Node heap, local SEO specialist checks
  - Risks: Production deployment is intentionally out of scope.

### Done

- [x] **[UI][BILLING]** Clarify billing information architecture
  - Spec: `meta/memory_bank/specs/work_items/2026-08-16__refactor__billing-ia-ux.md`
  - Owner: Codex
  - Branch: `codex/bugfix/yookassa-visible-payer-email`
  - Done: 2026-08-16
  - Summary: Add an explicit payment-settings destination using the existing balance deep-link and clarify balance/history terminology without changing billing APIs.
  - Tests: 33 frontend test files and 126 tests passed; typecheck remains blocked by existing 8361 repo-wide diagnostics.
  - Risks: Frontend-only navigation and conditional rendering; legacy settings route remains compatible.

# Current Tasks

This file tracks active development tasks for the Airis project.

**Worktree/branch rule:** do **not** edit this file on feature/bugfix/refactor branches. Use `.memory_bank/branch_updates/*` and consolidate on the integration branch per `.memory_bank/guides/task_updates.md`.

For non-trivial work items, each entry should include a `Spec:` link to a work item spec under `.memory_bank/specs/work_items/` (see `.memory_bank/specs/README.md`).

**Entry format rule (copy/paste safe):**

- Use the same bullet structure as `.memory_bank/branch_updates/_template.md`.
- Keep entries short; detailed design/implementation notes live in the work item spec.
- Minimum fields per entry:
  - `Spec: ...`
  - `Owner: ...`
  - `Summary: ...`
  - `Done:` (for completed) or `Started:` (for in progress)

---

## Recently Completed (Last 7 Days)

- [x] **[BUG]** Landing pricing: show rate cards for provider-only models
  - Spec: `.memory_bank/specs/work_items/2026-02-05__bugfix__public-pricing-rate-cards-provider-models.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Public `/billing/public/rate-cards` merges provider base models with workspace overrides so `/pricing` shows prices.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_billing_public_pricing.py"`
  - Risks: Low (provider model fetch adds some work; failures degrade gracefully).

- [x] **[BILLING][TEST]** Scenario-based billing E2E tests (wallet PAYG + topup + lead magnet)
  - Spec: `.memory_bank/specs/work_items/2026-02-05__feature__billing-scenarios-e2e-tests.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Add deterministic integration tests covering holds/charges/releases, insufficient funds, lead magnet, top-up recovery, and streaming usage.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml up -d airis-e2e`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e "npm run test:e2e -- e2e/billing_wallet_recovery.spec.ts"`
  - Risks: Medium (mocks for OpenAI router; guard against brittle coupling to OpenAI router internals)

- [x] **[DOCS]** Documentation + Memory Bank consistency cleanup
  - Spec: `.memory_bank/specs/work_items/2026-02-05__docs__docs-memory-bank-consistency-cleanup.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Align rules/examples (no `Any` in Python snippets), consolidate task updates, standardize compose command snippets, and add sharded Airis docs + solutions log.
  - Tests: N/A (docs-only)
  - Risks: N/A

- [x] **[DEV]** SDD toolkit: first-time project setup
  - Spec: `.memory_bank/specs/work_items/2026-02-05__docs__sdd-toolkit-setup.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Configure `.claude/` SDD permissions + defaults (git integration is read-only; no auto-commit/branch by default).
  - Tests: `sdd skills-dev setup-permissions check . --json`, `sdd skills-dev start-helper session-summary . --json`
  - Risks: N/A (local dev tooling config only)

- [x] **[LEGAL]** Publish оферта + acceptance tracking
  - Spec: `.memory_bank/specs/work_items/2026-02-05__feature__legal-offer-docs-acceptance.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Canonical `/terms` оферта + `/documents/*` legal pack; versioned acceptance logging and UI gate.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -T airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_legal.py open_webui/test/apps/webui/routers/test_auths.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps -T airis-frontend sh -lc "npm run test:frontend -- --run"`
  - Risks: Legal wording must be reviewed by counsel; acceptance gating could affect onboarding if misconfigured.

- [x] **[AUTH]** Yandex OAuth login (hooks + userinfo normalization)
  - Spec: `.memory_bank/specs/work_items/2026-02-05__feature__yandex-oauth-login.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Implement `/api/v1/oauth/yandex/*` thin hooks + normalize Yandex userinfo (email/name/picture) for shared OAuth flow.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= -e WEBUI_SECRET_KEY=secret-key airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_oauth_yandex.py open_webui/test/apps/webui/utils/test_oauth_yandex_normalization.py"`
  - Risks: Manual smoke test is still required after env+deploy; redirect URI mismatch can block login.

- [x] **[UI]** Admin billing models: audit-first pricing
  - Spec: `.memory_bank/specs/work_items/2026-02-04__feature__admin-models-pricing-audit-first.md`
  - Owner: Codex
  - Done: 2026-02-04
  - Summary: Default focus is Text with sortable Input/Output columns; missing prices always sort last; focus switch added for Images/Audio/All; “All” keeps compact summary.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run src/lib/utils/airis/model_pricing_audit.test.ts src/lib/utils/airis/model_pricing_completeness.test.ts src/lib/utils/airis/rate_cards.test.ts src/lib/utils/airis/admin_billing_models_page_compile.test.ts"`
  - Risks: N/A

- [x] **[BUG]** Rate card XLSX import: provider-only models + i18n placeholders
  - Spec: `.memory_bank/specs/work_items/2026-02-03__bugfix__rate-card-xlsx-import-provider-models-i18n.md`
  - Owner: Codex
  - Done: 2026-02-03
  - Summary: Import preview/apply now recognizes provider base models; apply auto-creates missing base model records; i18n placeholders interpolate and Step 2 summary duplication removed.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/apps/webui/routers/test_admin_billing_rate_card_xlsx.py"`, `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`

- [x] **[BUG]** Rate card page shows no models for provider-only setup
  - Spec: `.memory_bank/specs/work_items/2026-02-03__bugfix__rate-card-no-models.md`
  - Owner: Codex
  - Done: 2026-02-03
  - Summary: Merge provider base models with workspace overrides; auto-create missing base model records on save.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm --no-deps airis-frontend sh -lc "npm run test:frontend -- --run"`
  - Risks: Creating base model DB entries on explicit admin save may affect access-control enforced environments (mitigated: only on explicit admin save).

- [x] **[BUG]** YooKassa webhook: docs-aligned source verification (IP allowlist)
  - Spec: `.memory_bank/specs/work_items/2026-02-03__bugfix__yookassa-webhook-source-verification.md`
  - Owner: Codex
  - Done: 2026-02-03
  - Summary: Add optional IP allowlist verification (per YooKassa incoming notifications docs) and clarify signature verification semantics; keep provider API verification as the main gate.
  - Tests: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run -T --rm -e DATABASE_URL= -e WEBUI_SECRET_KEY=secret-key airis bash -lc "pytest -q"`
  - Risks: N/A

- [x] **[DEV]** Standardize Codex docs/actions for Docker Compose + remove non-Codex assistant tooling
  - Updated `AGENTS.md` + Memory Bank guides/workflows/specs to use Docker Compose-first test/lint commands.
  - Removed legacy non-Codex assistant config files/folders from the repo.

  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[BILLING][AUDIT]** Проверка корректности списаний (wallet + subscriptions)
  - Закрыта утечка денег: при недооценке токенов списание ограничивалось hold → часть стоимости не списывалась.
  - Усилен preflight: более консервативная оценка токенов (tiktoken + fallback), дефолтный cap для max output tokens.
  - Исправлено применение квот подписки: `plan.quotas` теперь читается по ключу `metric.value`, usage привязан к периоду подписки.
  - Усилена обработка вебхуков YooKassa: верификация по API провайдера + идемпотентность для subscription (без повторного продления).
  - YooKassa: добавлен timeout на HTTP-запросы; парсер вебхуков стал строже (валидирует `event`); опциональная защита вебхука через `YOOKASSA_WEBHOOK_TOKEN` и `?token=...` (не ломает `YOOKASSA_WEBHOOK_SECRET`).
  - Подписки: renewal теперь продлевает от `now`, если подписка просрочена (чтобы пользователь не терял оплаченные дни).
  - Тесты (docker): `pytest -q` — 145 passed.
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[QA]** Add billing UX tests (unit + e2e)
  - Unit: UnifiedTimeline URL filter sync
  - Unit: Wallet advanced settings auto-expand logic
  - E2E: Wallet hero + advanced collapse + history navigation smoke
  - Note: vitest config now includes SvelteKit plugin + browser conditions for client mounts
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Add assistant commands + instructions
  - Added project shortcuts and assistant tooling documentation (Codex-first, Docker Compose).
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Fix Codex worktree Local Environment setup
  - Make setup robust when `$wt` is empty; support Docker-first workflow (no local deps) and provide docker-based Actions. (The earlier failure was from creating venv on system Python 3.9, causing `uvicorn==0.40.0` install to fail.)
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[UI]** Simplify billing pages UX (Wallet/History/Plans)
  - Hero-first wallet layout with low-balance state, collapsed advanced settings, history URL filters, analytics + i18n/a11y updates
  - Spec: `.memory_bank/specs/billing_pages_ux_simplification.md`
  - Note: `npm run check` fails due to pre-existing svelte-check/TypeScript errors (katex-extension, utils/index, admin/Settings/Connections)
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Align assistant workflow compliance
  - Consolidated workflow compliance guardrails and task-update rules in Memory Bank + `AGENTS.md`.
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Enforce detailed commit messages with template + hook
  - Added commit message template, commit-msg hook, and setup script
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Add workflow compliance guardrails for Codex
  - Added workflow compliance gate in AGENTS and new `workflow-compliance` skill
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DOCS]** Align task update workflow to avoid branch conflicts
  - Updated AGENTS + Memory Bank workflows/specs to use branch_updates + task_updates guide
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[BILLING]** Update rate card prices from competitor analysis
  - Built import-ready XLSX with text token_in/out prices from Rec IN/OUT (RUB/1K)
  - Output: `.memory_bank/images/rate-cards-all_units_template (2)-filled.xlsx`
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[BUG]** Fix zero-priced rate cards (import + seed)
  - Updated `.memory_bank/images/rate-cards-all_units_template (2)-filled.xlsx` to remove active zero prices (fill missing token/image/audio rates; disable irrelevant modalities).
  - Changed `backend/open_webui/utils/billing_seed.py` to seed default rate cards as inactive (prevents free usage by default).
  - Added regression test: `backend/open_webui/test/apps/webui/utils/test_billing_seed.py`.
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[UI]** Improve rate card import preview UX
  - Added step-by-step preview/apply layout with prominent preview CTA and counter cards
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DEV]** Add interactive dev stack helper
  - New script: `scripts/dev_stack.sh` to run dev compose with HMR/reload and common actions
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[REFAC]** Minimize upstream diffs for chat billing/prefill
  - Moved welcome preset prefill + OpenAI billing metadata into `src/lib/utils/airis/*`
  - Kept upstream files to thin hooks: `Chat.svelte` (+prefill + include_usage policy), `openai/index.ts` (+body enhancer)
  - Added Vitest coverage for airis helpers; respect explicit `capabilities.usage` flag
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[BUG]** Fix duplicate dictation button in chat input
  - Removed duplicate `Dictate` render path so only one mic button shows next to Voice mode
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[BUG][AUTH]** GitHub OAuth не отображается в UI при запуске через `docker-compose.yaml`
  - **Root cause**: переменные `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` не прокидывались в контейнер, поэтому `/api/config` не возвращал `oauth.providers.github`
  - **Fix**: добавлены GitHub OAuth env vars в `docker-compose.yaml`, обновлены `.env.example` и `README-B2C-IMPLEMENTATION.md`
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[DOCS][ENV]** Привести `.env.example` и `docker-compose.yaml` к одному набору переменных
  - **Problem**: `.env.example` содержал переменные (OpenAI/CORS/SMTP/Scopes), которые не попадали в контейнер через `docker-compose.yaml`
  - **Fix**: добавлен pass-through переменных в `docker-compose.yaml`, расширен `.env.example`, добавлены `scripts/env_diff.sh` и `scripts/validate_env_example.sh` для безопасного сравнения/валидации без вывода секретов
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[TOOLS][ENV]** Скрипт для безопасной синхронизации `.env` по актуальному `.env.example`
  - **Goal**: обновлять `.env` после pull/апдейтов без потери текущих значений и без утечек секретов
  - **Fix**: добавлен `scripts/sync_env.py` (создаёт `.env.bak.<timestamp>` и печатает только названия ключей), документация в `README-B2C-IMPLEMENTATION.md`
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[QA]** Fix e2e selectors after billing timeline + welcome hero updates
  - Lead magnet checks scoped to card; history test mocks usage events; preset selectors stabilized
  - **Owner**: Codex
  - **Done**: 2026-02-01

- [x] **[BUG]** Fix wallet timeline + lead magnet UI regressions
  - Lead magnet fetch no longer blocks wallet load; charge entries handled correctly
  - i18n placeholders restored for wallet inputs; models list empty state corrected
  - **Owner**: Codex
  - **Done**: 2026-02-01

- [x] **[AUTH-02]** Add GitHub OAuth env config
  - Added GitHub OAuth variables to local `.env`.
  - **Owner**: Codex
  - **Done**: 2026-02-01
- [x] **[BUG]** Перевести отсутствующие строки на страницах биллинга Airis_b2c
  - RU переводы для admin/user billing + model pricing
  - Добавлены i18n-плейсхолдеры в форме плана, локализация \"Unknown\", валюты, email/телефон и числовые плейсхолдеры
- [x] **[MAINT]** Restore backend static assets

  - Reverted accidental removal of static icons, manifest, loader, and user assets
  - **Owner**: Codex
  - **Done**: 2026-02-01

- [x] **[UI-28]** Implement billing wallet UX redesign (wallet-first)

  - Unified timeline (ledger + usage) with filters and clear labels
  - Merged wallet + settings; lead-magnet model list; auto-topup UX polish
  - Spec: `.memory_bank/specs/billing_wallet_ux_redesign.md`
  - **Owner**: Codex
  - **Done**: 2026-02-01

- [x] **[SPEC]** Billing wallet UX redesign

  - Single wallet flow with unified timeline + settings merge (spec only)
  - Spec: `.memory_bank/specs/billing_wallet_ux_redesign.md`
  - **Owner**: Codex
  - **Done**: 2026-02-01

- [x] **[DEV-01]** Add Docker dev hot-reload compose

  - Backend: run `start.sh --reload` (avoid `backend/dev.sh` rewriting `DATABASE_URL` inside Docker)
  - Frontend: install deps when node_modules volume is empty (check `node_modules/.bin/vite`; uses `npm ci --legacy-peer-deps`)
  - Added polling env flags for Docker Desktop FS events (`WATCHFILES_FORCE_POLLING`, `CHOKIDAR_USEPOLLING`)
  - Goal: avoid rebuilding the image on every code change
  - **Owner**: Codex
  - **Done**: 2026-02-02

- [x] **[UI-27]** Convert admin model pricing list to responsive table

  - Desktop table with sortable headers + mobile card layout
  - Modalities shown as icon-only pills with tooltips
  - Added i18n strings and tests for modality ordering

- [x] **[BUG]** Fix rate card model save validation

  - Prevent save from aborting on valid effective-to or cost updates
  - Ensure form validation blocks only when input is invalid

- [x] **[BILLING-13][FEATURE]** Redesign rate card create UI for multi-model + multi-modality pricing

  - Added model picker with search + multi-select
  - Added modality cards with unit checkboxes and per-unit pricing
  - Added entry count preview in create form

- [x] **[BILLING-12][FEATURE]** Improve admin rate card table grouping

  - Grouped rows by model with expand/collapse
  - Added model-level selection and delete action
  - Preserved entry-level edit/delete + toggles

- [x] **[BILLING-11]** Add admin rate card deletion (single + bulk)

  - API: delete single entry + bulk delete by model/entry
  - Admin UI: selection + confirmation to avoid accidental deletes
  - Tests for delete endpoints

- [x] **[UI-24]** Перепроверить шрифты и типографику /pricing

  - Уточнены размеры микрокопии и межстрочные интервалы в hero/CTA
  - Добавлены табличные цифры для цен и сумм пополнения
  - Усилен акцент на суммах пополнения: лейбл 12px, чипы 15px на mobile

- [x] **[UI-25]** Fix estimator preset multiplier mismatch

  - Добавлен вариант 1.2x в dropdown, чтобы пресеты совпадали с выбором

- [x] **[UI-23]** Пересобрать /pricing по новому ТЗ + динамический Rate Card

  - Новый порядок секций, обновлённые тексты и CTA-логика
  - Rate Card из бэка (3–50 моделей) + updatedAt на UI
  - Конфиг для сумм пополнения, популярных/рекомендованных моделей
  - Фоллбеки и события аналитики по ТЗ

- [x] **[BUG]** Polish /welcome layout for examples + how callout

  - Prevent study badge from wrapping in examples cards
  - Stack the how-callout CTA under text for cleaner line breaks

- [x] **[BUG]** Fix /welcome landing follow-up issues after review

  - Hide audio examples/features when audio quotas are zero
  - Add tab a11y wiring (aria-controls/tabpanel) + reuse shared navigation helpers
  - Add Vitest coverage for welcome navigation helpers
  - Tests: `npm run test:frontend -- --run`

- [x] **[UI-22]** Обновить блоки /welcome после hero по новому ТЗ

  - Добавлены примеры с табами и пресетами + мобильный \"Показать ещё\"
  - Переписаны секции how/features/usecases/pricing/faq + финальный CTA
  - Добавлены якоря, единые формулировки оплаты и sticky CTA на mobile

- [x] **[BUG]** Stabilize welcome hero CTA + preset prefill after auth

  - Prevent decorative hero layers from intercepting CTA clicks
  - Ensure preset text applies after input mounts during auth redirect
  - Tests: `pytest`, `npm run test:frontend`, `npm run test:e2e`

- [x] **[TOOLS-01]** Create general code review skill

  - Added reusable code review skill with checklist references and templates

- [x] **[ASSETS]** Sync static/static logo assets with new favicon

  - Regenerated favicon/manifest/splash PNGs and ICOs from the new SVG

- [x] **[MAINT]** Clean up pytest warnings (SQLAlchemy/Alembic/Pydantic/deps)

  - Updated deprecated APIs and added targeted pytest warning filters

- [x] **[BUG]** Merge Alembic heads to unblock migrations in tests

  - Added merge migration for ab12cd34ef56 + c9b7a1d4e2f3

- [x] **[BUG]** Replace favicon PNG assets with SVG-converted logo

  - Regenerated favicon PNGs from SVG and aligned model defaults to `/static/favicon.png`

- [x] **[UI-11]** Replace app + landing logo with SVG

  - Swapped brand mark to SVG asset and updated app + landing logo usages

- [x] **[BILLING-10]** Simplify pricing for all modalities (remove factors)

  - Removed platform factor / fixed fee / min charge / rounding rules from rate cards
  - Pricing now uses raw per-unit cost (text uses per 1k tokens)
  - Added migration + updated admin UI and tests

- [x] **[BILLING-09]** Simplify text token pricing (per-1k) + paired input/output entry

  - Store token price as kopeks per 1k tokens and use input+output sum
  - Admin UI captures both token_in and token_out together to avoid partial rate cards

- [x] **[UI-20]** Clarify unit labels and raw cost meaning

  - Unit options now include “price per ...” hints; raw cost label clarified

- [x] **[UI-19]** Show unit as fixed value and add raw cost hints

  - Unit shows as fixed value for single-unit modalities; raw cost now shows per-unit hint

- [x] **[UI-18]** Add unit hints by modality in rate card form

  - Unit dropdown now explains tts/stt/image/text units

- [x] **[UI-17]** Adjust rate card unit by modality

  - Unit now auto-limits to valid options per modality (text/image/tts/stt)

- [x] **[UI-16]** Replace modality input with select

  - Modality field now uses a dropdown with text/image/tts/stt

- [x] **[UI-15]** Remove unused rate card fields from form

  - Hid informational fields (model tier, provider, version, rounding rules, default flag)
  - Kept only pricing + effective period inputs

- [x] **[UI-13]** Rename top-up wording to Russian

  - Replaced top-up labels in wallet/history/chat UI with Russian equivalents

- [x] **[UI-12]** Show fixed top-up amounts on /pricing

  - Added fixed top-up amounts in PAYG explainer block (1 000 / 1 500 / 5 000 / 10 000 ₽)

- [x] **[UI-11]** Add fixed top-up amounts on wallet + landing

  - Updated wallet top-up packages to 1 000, 1 500, 5 000, 10 000 ₽
  - Added fixed top-up amounts callout on the /welcome landing

- [x] **[DEPLOY-01]** Add Docker Hub deploy script (dev -> prod)

  - Added docker-compose.prod.yml to override image on prod
  - Added scripts/deploy_prod.sh for build/push/pull/up via SSH
  - Added .env.deploy to store deploy variables (ignored by git)
  - Added docs/DEPLOY_PROD.md with production deploy steps
  - Added optional prod git pull and post-deploy status output

- [x] **[I18N-01]** Add lead magnet UI strings (en-US, ru-RU)

  - Added translations for lead magnet labels, quotas, and admin config messages

- [x] **[DOCS-11]** Sync Memory Bank status with current implementation

  - Updated landing conversion plan gaps + phase status
  - Updated PAYG lead magnet policy + implementation plan progress

- [x] **[DOCS-09]** Update landing plan + block-by-block wording

  - Aligned plan with PAYG-only messaging, dynamic lead magnet quotas, and 2026 design direction
  - Added copy per block for /welcome, /features, /pricing, /about, /contact, /privacy, /terms

- [x] **[DOCS-10]** Create 2026 public pages plan (per-page wording + imagery)

  - Added `.memory_bank/specs/public_pages_2026_plan.md` with step-by-step blocks and copy
  - Included imagery guidance and execution order

- [x] **[UI-04]** Apply 2026 /welcome copy + dynamic free quotas

  - Updated hero copy and benefit chips per 2026 plan
  - Added use-case block and PAYG/free-start wording updates
  - Wired lead-magnet quotas from public settings into /welcome

- [x] **[UI-05]** Strong 2026 redesign pass for /welcome

  - Rebuilt hero layout with deeper visual hierarchy and layered light fields
  - Wrapped sections into card-like “bands” for scan-friendly structure

- [x] **[UI-06]** Strong 2026 redesign pass for /features

  - Rebuilt hero with stacked product collage and clearer CTA emphasis
  - Simplified blocks into card bands: models, capabilities, use-cases, reasons, final CTA

- [x] **[UI-07]** Strong 2026 redesign pass for /pricing

  - Rebuilt hero and PAYG explanation with 2026 visual bands
  - Added dynamic lead-magnet quotas and example cost block

- [x] **[UI-08]** Strong 2026 redesign pass for /about

  - Rebuilt hero with product collage and concise mission/values blocks
  - Removed stats and kept CTA-focused layout

- [x] **[UI-09]** Strong 2026 redesign pass for /contact

  - Rebuilt hero and support cards with 2026 visual bands
  - Simplified support path and preserved minimal form UX

- [x] **[UI-10]** Strong 2026 redesign pass for /privacy and /terms

  - Added summary blocks and 2026 hero layout for legal pages
  - Updated payment language to PAYG and refreshed dates

- [x] **[BUG]** Fix public rate card accuracy

  - Filtered public rate cards by effective date window
  - Corrected token pricing scale (per 1k) and image unit lookup for examples

- [x] **[LANDING-01]** Close Phase 1 conversion updates on /welcome

  - Added problem/solution block, capability grid, segment use cases, pricing preview, and FAQ
  - Split large sections into `WelcomePhaseOneSections` to keep file size within standards

- [x] **[DOCS-08]** Document landing conversion plan from expert reviews

  - Added `.memory_bank/specs/landing_conversion_plan.md` with phased roadmap and open questions
  - Updated plan with lead-magnet behavior, PAYG pricing data needs, and owner inputs

- [x] **[UI-03]** Refresh public pages design for AIris brand alignment

  - Updated /welcome, /about, /features, /pricing, /contact, /terms, /privacy
  - Replaced emoji visuals with iconography and product imagery
  - Aligned typography, CTA styles, and neutral palette with in-app UI

- [x] **[BUG]** Fix container crash when SRC_LOG_LEVELS missing keys

  - Defaulted OAuth and OpenGauss log levels to INFO when SRC_LOG_LEVELS lacks MAIN/RAG

- [x] **[BUG]** Fix container crash on missing email-validator

  - Added `email-validator` dependency required by Pydantic `EmailStr`

- [x] **[BUG]** Restore container boot after upstream merge

  - Removed leftover conflict marker in images router and added Alembic merge migration

- [x] **[BUG]** Restore page scrolling after splash screen

  - Scoped `overflow-y: hidden` to the splash state and remove it after load

- [x] **[LEGAL-01]** Add requisites for YooKassa verification

  - Added IP requisites (ИНН/ОГРНИП) to public footer for visibility on all public pages

- [x] **[BUG]** Stabilize backend test fixtures for billing flows

  - Use scoped SQLAlchemy session in billing-related tests
  - Enable image generation flag in image billing tests
  - Avoid extra admin user inflation in users router tests

- [x] **[UX]** Simplify /welcome content density

  - Removed redundant blocks and entry flow section from /welcome
  - Kept concise hero, steps, capabilities, PAYG + free start, and FAQ
  - Replaced hero image with real product screenshot and added framed presentation

- [x] **[UX]** Add /welcome hero visual variants for review

  - Added Spotlight stage and Stacked tilt screenshot treatments in hero
  - Stacked variants are shown sequentially on the same page for selection

- [x] **[TEST]** Stabilize E2E selectors and frontend test discovery

  - Added stable data-testid hooks for chat/user menu and model selection.
  - Updated Playwright specs with fallbacks and fixed Vitest test include/exclude.

- [x] **[BUG]** Free plan cancellation blocks re-subscribe

  - Added free plan activation and resume flow in billing UI and API. (legacy, removed 2026-01-23)

- [x] **[BUG]** Billing dashboard shows infinite spinner and no content

  - Added timeout/error state for billing info load with retry action and safer currency formatting.

- [x] **[BUG]** Prevent duplicate email in Yandex OAuth when merge disabled

  - Added duplicate-email guard aligned with signup/add routes; merges when enabled and blocks when disabled.

- [x] **[BUG]** Billing wallet endpoints returned 404 when wallet disabled

  - Enabled wallet by default in `docker-compose.yaml`, `.env.example`, and `.env` (`ENABLE_BILLING_WALLET=true`).

- [x] **[BILLING-01]** Implement billing system with YooKassa integration

  - Created database models (Plan, Subscription, Usage, Transaction, AuditLog)
  - Implemented backend API (user billing + admin billing)
  - Built frontend UI (plans catalog, dashboard, admin panel)
  - Added quota enforcement middleware
  - Integrated payment webhooks

- [x] **[BILLING-02]** Add audit logging for admin actions

  - Created AuditLog model with action enums
  - Implemented logging in all admin endpoints
  - Added audit log viewer in admin panel

- [x] **[BILLING-05]** Implement B2C monetization (wallet + PAYG)

  - Wallet + rate card models, admin CRUD/sync, topup + webhook credit, hold/settle integration, guardrails + unit tests
  - Frontend wallet UI + pricing + admin model pricing + auto-topup
  - E2E: Playwright wallet tests + admin storage state; `npm run test:e2e` passes (chat tests skipped without models)

- [x] **[DOCS-02]** Set up Memory Bank documentation structure
  - Created comprehensive project documentation
  - Documented tech stack, coding standards, patterns
  - Added workflows for common development tasks

---

## In Progress

### High Priority
- [x] **[AUTH-01]** Verify GitHub OAuth login visibility
  - Confirm backend GitHub OAuth support and prerequisites.
  - Identify conditions for showing the GitHub login button in the UI.
  - **Owner**: Codex
  - **Target**: 2026-02-01

- [x] **[SPEC]** Model management lifecycle + pricing visibility flow

  - Document business rules, states, and acceptance criteria
  - Map code touchpoints and estimate effort
  - **Owner**: Codex
  - **Target**: 2026-01-24

- [x] **[MODEL-01]** Align model visibility + pricing flow

  - Public pricing filters out inactive, access-controlled, and hidden models in `/billing/public/rate-cards`.
  - Modality disabled errors returned explicitly as `{"error": "modality_disabled"}` (covered by backend tests).
  - Model delete deactivates all related rate cards via `RateCards.deactivate_rate_cards_by_model_ids`.
  - **Owner**: Codex
  - **Done**: 2026-01-26

- [x] **[BILLING-15][REFACTOR]** Remove effective from/to from rate cards

  - `effective_from/effective_to` removed from `billing_pricing_rate_card`; `created_at` added for ordering and immutable history.
  - Postgres-safe backfill implemented (DDL separated from backfill to avoid Alembic batch buffering issues).
  - Admin model pricing list supports bulk delete for selected models again.
  - **Owner**: Codex
  - **Done**: 2026-01-26

- [x] **[UI-21]** Обновить hero + header /welcome по новому ТЗ
  - Новый hero с CTA, trust chips и быстрыми пресетами
  - Обновить header (mobile CTA + burger + трекинг событий)
  - Обновить hero визуал под сценарий текст + изображения
  - **Owner**: Codex
  - **Target**: 2026-01-21
- [x] **[UI-26]** Обновить /features по новому ТЗ (возможности)
  - Новый порядок секций, CTA-логика и тексты
  - Пресеты, табы, модели и FAQ по спецификации
  - Динамический список моделей из публичного Rate Card
  - **Owner**: Codex
  - **Target**: 2026-01-22
- [x] **[BILLING-14][FEATURE]** Single-flow rate card editor per model
  - Единый список моделей со статусом и действием Add/Edit
  - Модальные карточки модальностей с сохранением истории (is_active=false)
  - Добавлены утилиты для статусов моделей и индекса rate cards + тесты
  - **Owner**: Codex
  - **Target**: 2026-01-23
- [x] **[BILLING-07]** Define PAYG default + lead magnet access logic

  - Make PAYG the default billing mode without subscription
  - Admin-configurable lead magnet: monthly quotas (tokens, images, TTS, STT) + cycle length (X days)
  - Allowlist models flagged as “free/lead magnet” (only those use trial quotas)
  - Define precedence between lead-magnet limits and paid wallet usage
  - Spec saved: `.memory_bank/specs/payg_lead_magnet_policy.md`
  - **Owner**: TBD
  - **Target**: TBD

- [x] **[BILLING-08]** Implement PAYG default + lead magnet access

  - Implemented lead magnet config/state + billing integration (preflight/hold/settle) with fallback to PAYG wallet.
  - Lead magnet eligibility uses selected model ID consistently (handles provider `base_model_id`).
  - User/API/UI flows wired: `/billing/lead-magnet`, `/billing/usage-events`, billing dashboard/history sections.
  - Backend tests cover lead magnet evaluation/consume + billing lead magnet routes.
  - **Owner**: Codex
  - **Done**: 2026-01-26

- [x] **[BILLING-12]** Remove chat estimate UI and endpoint

  - `/billing/estimate` endpoint removed from backend routers; no UI usage in chat/billing routes.
  - Server-side preflight/hold remains to prevent overdraft.
  - Note: client types may still contain legacy `is_estimated/estimate_reason` fields; safe to clean up when convenient.
  - **Owner**: TBD
  - **Done**: 2026-01-26

- [ ] **[BILLING-03]** Test billing system end-to-end

  - Cover plan subscription flow end-to-end (UI -> payment -> webhook -> subscription state)
  - Cover payment processing and webhooks (YooKassa) in an E2E-like environment
  - Cover quota enforcement and billing error surfaces
  - Cover audit logging assertions for admin actions
  - Current state: backend pytest coverage exists for key billing flows; Playwright has wallet/lead-magnet specs but no webhook/subscription E2E coverage yet
  - **Owner**: TBD
  - **Target**: Week of 2025-12-16

- [x] **[BILLING-06]** Split context vs generation billing costs (DB columns + UI)

  - Added usage/ledger columns for input/output costs and rate card IDs
  - Extended estimate response and billing UI breakdowns
  - Updated billing integration tests (19 passed)
  - **Owner**: TBD
  - **Target**: 2025-12-22

- [ ] **[BILLING-04]** Add usage analytics dashboard

  - Show usage trends over time
  - Display quota utilization charts
  - Add cost projections
  - Current state: admin plan analytics page exists but uses demo data; needs real aggregation + queries
  - **Owner**: TBD
  - **Target**: 2025-12-20

- [x] **[UI-02]** Simplify billing UX (wallet-first for B2C)

  - Merge wallet balance, limits, and billing contacts into one screen
  - Reduce billing navigation to Wallet + History (+ Plans when enabled)
  - Simplify history view for non-technical users
  - **Owner**: Codex
  - **Target**: TBD

- [x] **[BUG]** Show user name in header menu for registration flow
  - Enable profile header in chat/channel user menu dropdown to display name
  - Fixes registration E2E expectation on user name visibility
  - **Owner**: Codex
  - **Target**: TBD

### Medium Priority

- [ ] **[FEATURE-01]** Improve AI model switching UX

  - Add model comparison UI
  - Show model capabilities and pricing
  - Implement model recommendations
  - **Owner**: TBD
  - **Target**: Q1 2026

- [ ] **[FEATURE-02]** Enhance knowledge base with vector search
  - Optimize embedding generation
  - Improve search relevance
  - Add multi-document reasoning
  - **Owner**: TBD
  - **Target**: Q1 2026

### Low Priority

- [ ] **[DOCS-03]** Add API documentation for billing endpoints

  - Document all billing API endpoints (wallet/PAYG/lead-magnet + admin)
  - Add request/response examples and common error cases
  - Update/replace legacy docs that still describe subscription-only flows
  - **Owner**: TBD
  - **Target**: 2026-01-15

- [ ] **[UI-01]** Improve mobile responsiveness
  - Optimize chat interface for mobile
  - Fix billing UI on small screens
  - Test on various devices
  - **Owner**: TBD
  - **Target**: Q1 2026

---

## Backlog

### Features

- **[FEATURE-03]** Multi-user workspaces with shared billing
- **[FEATURE-04]** API platform for third-party integrations
- **[FEATURE-05]** AI agents with multi-step reasoning
- **[FEATURE-06]** Workflow automation builder
- **[FEATURE-07]** Custom model fine-tuning integration
- **[FEATURE-08]** Mobile apps (iOS/Android)

### Technical Improvements

- **[TECH-01]** Add comprehensive test suite (backend + frontend)
- **[TECH-02]** Set up CI/CD pipeline
- **[TECH-03]** Implement caching strategy with Redis
- **[TECH-04]** Add performance monitoring (Prometheus/Grafana)
- **[TECH-05]** Set up error tracking (Sentry)
- **[TECH-06]** Database query optimization
- **[TECH-07]** Add rate limiting per endpoint
- **[TECH-08]** Align frontend dependencies and verify installs
  - Upgrade mismatched TipTap packages (bubble-menu v2 -> v3)
  - Run via Docker Compose:
    - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm ci --legacy-peer-deps"`
    - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc "npm run test:frontend"`
  - **Owner**: TBD
  - **Target**: TBD

### Documentation

- **[DOCS-04]** User guide for billing features
- **[DOCS-05]** Developer onboarding guide
- **[DOCS-06]** Deployment guide (Docker/Kubernetes)
- **[DOCS-07]** API reference documentation

---

## Blocked

_No blocked tasks currently_

---

## Task Workflow

### Status Definitions

- **To Do**: Task defined but not yet started
- **In Progress**: Actively being worked on
- **Blocked**: Waiting on external dependency or decision
- **Done**: Completed and merged to main branch

### Priority Levels

- **High**: Critical for current release or blocking other work
- **Medium**: Important but not urgent
- **Low**: Nice to have, can be deferred

### Task Format

```
- [ ] **[CATEGORY-ID]** Task title
  - Description point 1
  - Description point 2
  - **Owner**: Developer name or TBD
  - **Target**: Completion date or milestone
```

---

## Notes

### Recent Architectural Decisions

1. **Billing System Architecture** (2025-12-10)

   - Chose YooKassa for Russian market support
   - Implemented quota enforcement at middleware level
   - Used Peewee ORM for consistency with existing codebase
   - Added comprehensive audit logging for compliance

2. **Frontend Framework** (2025-12-10)

   - Using Svelte 5 with SvelteKit 2
   - Tailwind CSS 4 for styling
   - TypeScript for type safety
   - Component-based architecture

3. **AI Provider Strategy** (2025-12-10)
   - Multi-provider support (OpenAI, Anthropic, Google, Ollama)
   - Fallback mechanisms for provider failures
   - Quota tracking per provider and model

### Upcoming Decisions Needed

- [ ] Choose monitoring/observability solution
- [ ] Define testing strategy and coverage targets
- [ ] Plan mobile app architecture
- [ ] Decide on internationalization strategy beyond EN/RU

---

**Last Updated**: 2026-01-29
**Project Version**: 0.6.41
**Active Contributors**: 1 (maintainer)

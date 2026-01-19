# Landing and Product Conversion Plan

## Purpose
Create a detailed, step-by-step plan to improve conversion on public pages and align messaging with the actual product, pricing, and usage logic. This plan is based on expert reports plus a review of public pages, billing flows, and lead-magnet behavior.

## Scope
- Public pages: `/welcome`, `/features`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`
- Public components: `src/lib/components/landing/*`
- Pricing logic and copy consistency with billing mode (subscriptions vs wallet)
- Product positioning, value proposition, and CTA strategy

## Out of Scope (for this plan)
- Chat UI redesign
- Admin-only billing and internal billing API changes
- New payment providers

## Inputs Reviewed
- Expert report 1: conversion, value proposition, local market, structure, CTA, social proof, pricing clarity
- Expert report 2: conversion gaps, trust, visuals, CTA, pricing transparency, SEO, mobile
- Current code: `src/routes/*` public pages, `src/lib/components/landing/*`, billing UI in `src/routes/(app)/billing/*`

## Confirmed Inputs (Owner)
- Public model names: GPT-5.2, Gemini 3 (Claude Opus 4.5 not yet added)
- Model IDs (current): `gpt-5.2`, `gemini/gemini-3-pro-preview`
- Works without VPN in Russia
- Free lead magnet usage exists
- PAYG is default billing mode
- Real product screenshots will be provided
- Legal entity: ИП Шишеня Ян Александрович
- No verified stats to claim
- No social channels
- Public support email: support@airis.you
- Allowed to use provider logos
- Allowed to mention external AI providers in copy
- Lead magnet quotas are admin-configurable and must auto-update on public pages
- Do not mention subscriptions yet (PAYG only)
- Use-cases: education, work, creativity (all three)
- No video/GIF in hero (static visuals only)
- Do not show free-model list on /welcome
- Show lead-magnet quotas in raw units (tokens/seconds)
- Add a simple "пример расходов" block on /pricing

---

## Current State Summary (What exists now)

### /welcome
- 2026 hero layout with product screenshot, benefit chips, and clear CTAs.
- Steps + capabilities + use-cases + PAYG/free-start + FAQ + final CTA.
- Lead-magnet quotas shown dynamically from public settings.

### /features
- 2026 hero with stacked product collage and CTA.
- Model list, capabilities, use-cases, highlights, final CTA.

### /pricing
- PAYG-first hero and explanation.
- Dynamic rate cards, lead-magnet quotas, and example costs.

### /about
- 2026 hero with product collage.
- Mission, approach, values, and CTA (no public stats).

### /contact
- 2026 hero with support email CTA and response expectations.
- Form is client-only simulation (no real submit). No social links.

### /privacy and /terms
- Updated to AIris branding and legal entity (ИП Шишеня Ян Александрович).
- Added summary blocks and PAYG wording alignment.

### Product/Billing logic (in-app)
- Supports subscriptions and wallet (PAYG).
- Lead magnet quotas exist (trial-like free usage).
- Public pages now explain PAYG and expose dynamic lead-magnet quotas + rate cards.

---

## Lead Magnet Behavior (from code)

### Configuration
- Env/config flags:
  - `LEAD_MAGNET_ENABLED`
  - `LEAD_MAGNET_CYCLE_DAYS`
  - `LEAD_MAGNET_QUOTAS` (JSON: `tokens_input`, `tokens_output`, `images`, `tts_seconds`, `stt_seconds`)
- Defined in `backend/open_webui/config.py`, read in `backend/open_webui/utils/lead_magnet.py`.

### Eligibility
- Lead magnet applies **only** to models with `meta.lead_magnet = true`.
- Lookup uses `Models.get_model_by_id()` inside `is_lead_magnet_model()`.

### Preflight / Charging
- If lead magnet allowed:
  - `billing_source = lead_magnet`
  - Wallet hold is skipped
  - Chat estimate renders as **Free**
- If not allowed: PAYG wallet logic applies (balance, caps, holds).

### Consumption
- Text: consumes `tokens_input`, `tokens_output`
- Images: consumes `images`
- TTS/STT: consumes seconds
- Usage events are recorded with `billing_source = lead_magnet`.

### UI Exposure
- "Free" badge shown on lead-magnet models in model selector.
- Lead-magnet quotas and cycle reset surfaced in billing dashboard.

---

## Public Data Sources (Implemented for auto-updating copy)

### Lead Magnet Quotas (Public)
Goal: show **real quotas** on public pages and auto-update when admin changes settings.
Implemented:
- `GET /api/billing/public/lead-magnet` returns enabled, cycle_days, quotas (raw units).
Used by `/welcome` and `/pricing`.

### PAYG Rate Card (Public)
Goal: show **real numbers** for PAYG pricing on `/pricing`.
Implemented:
- `GET /api/billing/public/rate-cards` returns latest effective rate cards (token_in/out, image, tts, stt).
- Rate cards are filtered by effective date window.
Used by `/pricing` for the dynamic list and example costs.

---

## Key Gaps (Remaining)

1. **No social proof yet**
   - Testimonials/logos are still absent; no verified public stats to show.

2. **Contact form is still simulated**
   - Form is client-only; support email is the primary channel.

3. **SEO/analytics not implemented**
   - No structured FAQ, event tracking, or A/B test plan executed yet.

---

## 2026 Design Direction (Applied to All Public Pages)

**Goal:** contemporary “human-tech minimalism” — calm, high-contrast, tactile depth, low noise.

**Core principles**
1. **Short copy blocks + scan-friendly layout** (F-pattern reading).
2. **Product-forward visuals** (real UI screenshots, no stock photos where possible).
3. **Subtle depth** (soft glows, gentle shadows, layered panels).
4. **One primary action per screen** (clarity > choice overload).
5. **PAYG-first narrative** (clear price transparency, no subscription talk).
6. **Dynamic trust** (real numbers only; no fake stats).
7. **Performance first** (LCP/CLS friendly, avoid heavy media).

---

## Conversion-Oriented Information Architecture (Target)

1. **Hero**
   - Clear value prop: "All top AI models in one place" + local benefits.
   - Subcopy with specific benefits and entry barrier removal.
   - Primary CTA: "Start free" (only if a real free entry exists).
   - Secondary CTA: "See models / How it works" (anchor).

2. **Problem and solution**
   - 1 short block: "multiple services -> one workspace".

3. **Capabilities**
   - "Text, images, audio, code" with examples.
   - Model logos or model list (only if accurate and permitted).

4. **How it works (3 steps)**
   - Use non-technical wording.

5. **Use cases by segment**
   - Students, creators, business, developers, teams.

6. **Proof & trust**
   - Testimonials or user quotes.
   - If not available, replace stats with verified metrics or trust signals (security, compliance, uptime).

7. **Pricing preview**
   - "Plans or PAYG" summary.
   - Example cost blocks.
   - Link to full pricing.

8. **FAQ**
   - Payments, free usage, data privacy, model list, cancellation.

9. **Final CTA**
   - Repeat primary CTA.

---

## Updated Plan + Wording (Block by Block)

> Notes:  
> - Copy is written for B2C and pays attention to scan patterns.  
> - “Без VPN” and RUB payments are explicit (confirmed true).  
> - Free lead magnet shows **real quotas** from settings (auto-update).  
> - All CTAs align to “Start free” as primary action.  

### /welcome (Main Landing)

**1) Hero**
- **H1:** «Все ведущие AI‑модели в одном окне»
- **Subhead:** «Без VPN, с оплатой в рублях и бесплатным стартом»
- **Support line:** «GPT‑5.2 и Gemini 3 — в одном чате»
- **Primary CTA:** «Начать бесплатно»
- **Secondary CTA:** «Смотреть возможности»

**2) Visual (Product screenshot)**
- **Caption:** «Интерфейс AIris»  
- **Goal:** show real UI; use soft glow / stacked tilt (choose best variant).

**3) Trust/Benefit chips (3–4 items)**
- «Без VPN»
- «PAYG без подписок»
- «Оплата в рублях»
- «Бесплатный старт»

**4) How it works (3 steps)**
- Step 1: «Выберите модель под задачу»
- Step 2: «Сформулируйте запрос как в чате»
- Step 3: «Платите только за фактическое использование»

**5) Capabilities (4 cards)**
- «Тексты и анализ» — «статьи, резюме, планы, идеи»
- «Изображения» — «иллюстрации и визуалы под задачу»
- «Аудио» — «озвучка и распознавание»
- «Код и данные» — «помощь с кодом и объяснения»

**6) Use-cases (3 segments)**
- **Учёба:** «рефераты, конспекты, объяснения»
- **Работа:** «презентации, письма, анализ»
- **Творчество:** «идеи, визуалы, тексты»

**7) PAYG + Free Start**
- **Title:** «Платите по факту — стартуйте бесплатно»
- **Body:** «Стоимость видна до отправки. Списание только за фактическое использование.»
- **Dynamic quotas:** show actual quotas from settings (tokens/images/tts/stt + cycle days).
- **CTA:** «Начать бесплатно»

**8) FAQ (3–5 вопросов)**
- «Как считается стоимость?»
- «Есть ли бесплатный доступ?»
- «Почему не все модели бесплатные?»
- «Как пополнить баланс?»
- «Нужен ли VPN?»

**9) Final CTA**
- **Title:** «Готовы попробовать?»
- **Body:** «Начните бесплатно и получите доступ к лучшим моделям в одном месте.»
- **CTA:** «Начать бесплатно»

---

### /features

**1) Hero**
- **Title:** «Возможности AIris»
- **Subtitle:** «Один сервис для текста, изображений, аудио и кода»
- **CTA:** «Начать бесплатно»

**2) Models (short list)**
- «GPT‑5.2 (OpenAI)»
- «Gemini 3 (Google)»
- Note: «Список обновляется по мере появления новых моделей»

**3) Core capabilities (4–6 cards)**
- «Мульти‑модели»
- «Контекстные диалоги»
- «Файлы и заметки»
- «Приватность и контроль»
- «API и интеграции» (если реально есть)

**4) Use-cases (3 blocks)**
- Учёба / Работа / Творчество (короткие 2–3 пункта)

**5) Why AIris (3 points)**
- «PAYG без подписок»
- «Без VPN»
- «Русский интерфейс + рубли»

**6) CTA**
- «Начать бесплатно»

---

### /pricing

**1) Hero**
- **Title:** «PAYG‑оплата без подписок»
- **Subtitle:** «Платите только за фактическое использование»
- **CTA:** «Начать бесплатно»

**2) PAYG explanation (short)**
- «Стоимость видна до отправки»
- «Отдельная цена за вход/выход»
- «Прозрачная история списаний»

**3) Real rate cards (dynamic)**
- Реальные ставки по моделям, из API.

**4) Lead magnet (dynamic)**
- Заголовок: «Бесплатный старт на выбранных моделях»
- Квоты — реальные данные из настроек (авто‑обновление).

**5) Пример расходов (short)**
- 2–3 сценария: «10 сообщений в день», «50 сообщений в день», «1 изображение».
- Считать по текущим ставкам (динамически, если возможно).

**6) FAQ (3–4)**
- «Как считается стоимость?»
- «Есть ли бесплатный доступ?»
- «Как пополнить баланс?»

---

### /about

**1) Hero**
- «AIris — простой доступ к AI без сложностей»

**2) Mission**
- «Делаем AI доступным и понятным для повседневных задач»

**3) Values**
- Безопасность / Надёжность / Поддержка

**4) CTA**
- «Начать бесплатно»

> Убрать статистику до появления реальных данных.

---

### /contact

**1) Hero**
- «Свяжитесь с нами»

**2) Primary contact**
- Email: support@airis.you

**3) Simple form**
- Имя / Email / Вопрос (минимум полей)

---

### /privacy /terms

**1) Summary block at top**
- «Коротко: что собираем, зачем, как защищаем»

**2) Legal text**
- Обновить бренд и юр.лицо: ИП Шишеня Ян Александрович

---

## Detailed Implementation Plan

### Phase 0 — Decisions and Inputs (Blocking)
Status: complete (2026-01-19).
1. Confirm product claims allowed on public pages:
   - "No VPN required" (legal/technical truth)
   - "Pay in RUB" and supported payment methods
   - Free access: lead magnet quotas and eligible models
   - Model list and exact providers
2. Confirm legal entity and public contact info for legal pages.
3. Provide real product screenshots or approve using sanitized demo data.
4. Decide on pricing model narrative (PAYG-first vs subscription-first).

### Phase 1 — Copy and IA for /welcome
Status: complete (2026-01-19).
1. Rewrite hero: explicit value proposition + local advantage.
2. Replace steps with plain-language flow.
3. Add "capabilities" block (text, images, audio, code) with examples.
4. Add "use cases by segment" block.
5. Add "pricing preview" + "free access" note (lead magnet + eligible models).
6. Add "FAQ" section with 4-5 core questions.
7. Audit CTA alignment (only one primary action per screen).

### Phase 2 — /features Page
Status: complete (2026-01-19).
1. Add model list and capability taxonomy.
2. Add "model chooser logic" and "why multiple models".
3. Add examples per segment (short prompts + outcomes).

### Phase 3 — /pricing Page
Status: complete (2026-01-19).
1. Explain PAYG only (no subscription mention).
2. Add a simple rate card preview (PAYG default, real numbers).
3. Add a minimal cost calculator (inputs: messages/day, model tier).
4. Add "what is included" notes and cancellations policy in FAQ.

### Phase 4 — Trust and Proof
Status: partial (2026-01-19).
Remaining: testimonials/logos, verified stats, dedicated security trust block.
1. Add product screenshots or UI demo.
2. Add testimonials or remove unverifiable stats.
3. Add security and privacy highlights.

### Phase 5 — Legal and Contact
Status: partial (2026-01-19).
Remaining: make contact form functional or remove it.
1. Update `/terms` and `/privacy` to correct legal entity + brand.
2. Make contact form functional or replace with mailto + support channels.
3. Remove social links section or replace with support channels.

### Phase 6 — SEO and Analytics
Status: not started.
1. Update meta titles/descriptions to include primary search queries.
2. Add structured FAQ (if available).
3. Add event tracking for CTA clicks and scroll depth.
4. Define A/B test plan for hero value prop and CTA copy.

### Phase 7 — Lead Magnet Messaging Alignment
Status: complete (2026-01-19).
1. Explain "free lead magnet" clearly:
   - Free usage on selected models only
   - Quota resets every `LEAD_MAGNET_CYCLE_DAYS`
2. List public quotas from config.
3. Show "Free" badges only where meta flag is set.
4. Add FAQ: "Почему не все модели бесплатные?" + "Как считаются лимиты?"

### Phase 8 — Public Data Plumbing
Status: complete (2026-01-19).
1. Implement public lead-magnet config endpoint (see Public Data Sources).
2. Implement public rate-card endpoint (selected models only).
3. Wire `/welcome` and `/pricing` to fetch and render these values.
4. Add caching / fallback behavior when endpoint fails.

---

## File-Level Work List (Current Code References)

### Public pages
- `src/routes/welcome/+page.svelte`
- `src/routes/features/+page.svelte`
- `src/routes/pricing/+page.svelte`
- `src/routes/about/+page.svelte`
- `src/routes/contact/+page.svelte`
- `src/routes/privacy/+page.svelte`
- `src/routes/terms/+page.svelte`

### Shared landing components
- `src/lib/components/landing/PublicPageLayout.svelte`
- `src/lib/components/landing/NavHeader.svelte`
- `src/lib/components/landing/HeroSection.svelte`
- `src/lib/components/landing/FeaturesGrid.svelte`
- `src/lib/components/landing/CTASection.svelte`
- `src/lib/components/landing/FooterLinks.svelte`

### Billing UX alignment
- `src/routes/(app)/billing/dashboard/+page.svelte`
- `src/routes/(app)/billing/balance/+page.svelte`
- `src/routes/(app)/billing/plans/+page.svelte`
- `src/lib/apis/billing/*` (if API changes needed)

---

## Questions / Inputs Needed

_No open questions for copy/IA. Ready for implementation._

---

## Success Criteria

- Clear value proposition within 5 seconds.
- One primary CTA per section; minimal confusion.
- Product visuals and trust signals are credible.
- Pricing logic is transparent (users know how they pay).
- Public pages reflect actual product behavior and legal entity.

# Public Pages 2026 Plan (AIris)

## Purpose

Create a step-by-step, page-by-page plan for all public pages with 2026-style design direction, block structure, wording, and image guidance. This plan assumes:

- PAYG only (no subscription messaging)
- Lead magnet quotas are dynamic and must auto-update from settings
- No public stats or social proof yet
- No video/GIF in hero
- No free model list on /welcome

## Implementation Status (2026-01-19)

- /welcome: implemented
- /features: implemented
- /pricing: implemented
- /about: implemented
- /contact: implemented
- /privacy: implemented
- /terms: implemented

## Scope

Public pages only:

- /welcome
- /features
- /pricing
- /about
- /contact
- /privacy
- /terms

## 2026 Design Direction (Global)

- Human-tech minimalism: calm, high-contrast, tactile depth, low noise.
- Soft light fields and subtle glow behind hero visuals; layered surfaces (light depth).
- Large, confident typography with short blocks for scanning.
- One primary CTA per screen; secondary CTA only where needed.
- Product-forward imagery (real UI), minimal or no stock photos.
- Accessibility first: clear contrast, large tap targets, readable spacing.
- Performance: avoid heavy media; keep LCP clean and stable.

## Global Content Rules

- Use short, scan-friendly copy (headlines + 1–2 lines).
- No claims that are not verifiable (no stats, no testimonials yet).
- Repeat the core promise: “all leading models, no VPN, RUB payments, free start.”
- Lead magnet quotas displayed in raw units (tokens/seconds), dynamic from settings.
- Keep free-start CTA consistent: “Начать бесплатно”.

---

# Page-by-Page Plan (Sequential Execution)

## 1) /welcome (Main landing)

### Goal

Explain the product in 5 seconds, show real UI, remove friction, and drive a free start.

### Block Plan + Wording

**Block 1: Hero**

- Eyebrow: "GPT-5.2 и Gemini 3 в одном интерфейсе"
- H1: "Все ведущие AI‑модели в одном окне"
- Subhead: "Без VPN, с оплатой в рублях и бесплатным стартом"
- Supporting line: "Пишите, анализируйте и создавайте контент быстрее в одном чате."
- Primary CTA: "Начать бесплатно"
- Secondary CTA: "Смотреть возможности"

**Block 2: Product visual**

- Caption: "Интерфейс AIris"
- Use the best of the two visual treatments (Spotlight or Stacked Tilt).

**Block 3: Benefit chips (3–4 items)**

- "Без VPN"
- "PAYG без подписок"
- "Оплата в рублях"
- "Бесплатный старт"

**Block 4: How it works (3 steps)**

- Step 1: "Выберите модель под задачу"
- Step 2: "Сформулируйте запрос как в чате"
- Step 3: "Платите только за фактическое использование"

**Block 5: Capabilities (4 cards)**

- "Тексты и анализ" — "письма, резюме, идеи, планирование"
- "Изображения" — "визуалы и иллюстрации по описанию"
- "Аудио" — "озвучка и распознавание"
- "Код и данные" — "помощь с кодом и объяснения"

**Block 6: Use-cases (3 segments)**

- "Учёба" — "конспекты, объяснения, практика"
- "Работа" — "презентации, письма, анализ"
- "Творчество" — "идеи, тексты, визуалы"

**Block 7: PAYG + Free Start (dynamic quotas)**

- Title: "Платите по факту — стартуйте бесплатно"
- Body: "Стоимость видна до отправки. Списание только за фактическое использование."
- Dynamic quotas pulled from public lead magnet config:
  - Токены (ввод/вывод)
  - Изображения
  - TTS / STT (сек)
  - Цикл обновления (X дней)
- CTA: "Начать бесплатно"

**Block 8: FAQ (4–5 items)**

- "Как считается стоимость?"
- "Есть ли бесплатный доступ?"
- "Почему не все модели бесплатные?"
- "Как пополнить баланс?"
- "Нужен ли VPN?" (ответ: нет)

**Block 9: Final CTA**

- Title: "Готовы попробовать?"
- Body: "Начните бесплатно и получите доступ к лучшим моделям в одном месте."
- CTA: "Начать бесплатно"

### Imagery

- Primary hero: real UI screenshot. No stock.
- Use soft glow + layered frame to integrate dark UI with light background.

---

## 2) /features

### Goal

Explain the core value and “what you can do” with minimal duplication.

### Block Plan + Wording

**Hero**

- Eyebrow: "Возможности"
- H1: "Все ключевые возможности AIris"
- Subhead: "Тексты, изображения, аудио и код — в одном интерфейсе"
- CTA: "Начать бесплатно"

**Block 1: Models (short list)**

- "GPT‑5.2 (OpenAI)"
- "Gemini 3 (Google)"
- Note: "Список обновляется по мере появления новых моделей"

**Block 2: Capabilities (4–6 cards)**

- "Мульти‑модели"
- "Контекстные диалоги"
- "Файлы и заметки"
- "Приватность"
- "API и интеграции" (если реально доступны)

**Block 3: Use-cases (3 segments)**

- Учёба / Работа / Творчество

**Block 4: Why AIris (3 points)**

- "PAYG без подписок"
- "Без VPN"
- "Оплата в рублях"

**Final CTA**

- "Начать бесплатно"

### Imagery

- Use product UI collage (2–3 crops), no stock.
- If extra visuals needed: iconography only.

---

## 3) /pricing

### Goal

Make PAYG transparent and reduce pricing anxiety.

### Block Plan + Wording

**Hero**

- Eyebrow: "Тарифы"
- H1: "PAYG‑оплата без подписок"
- Subhead: "Платите только за фактическое использование"
- CTA: "Начать бесплатно"

**Block 1: PAYG explanation**

- "Стоимость видна до отправки"
- "Отдельная цена за ввод/вывод"
- "Прозрачная история списаний"

**Block 2: Real rate cards (dynamic)**

- Pull from public rate card API.
- Show by model + modality (token_in/out, image, tts, stt).

**Block 3: Lead magnet (dynamic)**

- Title: "Бесплатный старт на выбранных моделях"
- Quotas in raw units + cycle days

**Block 4: Example costs (new)**

- 2–3 short scenarios computed from current rates:
  - “10 сообщений в день (текст)”
  - “50 сообщений в день (текст)”
  - “1 изображение (1024px)”

**FAQ (3–4)**

- "Как считается стоимость?"
- "Есть ли бесплатный доступ?"
- "Как пополнить баланс?"

### Imagery

- Prefer UI screenshot of billing wallet/balance (if available).
- If no real UI: abstract gradient chart (no stock).

---

## 4) /about

### Goal

Communicate mission and reliability without fake stats.

### Block Plan + Wording

**Hero**

- H1: "AIris — доступный и понятный AI"
- Subhead: "Мы делаем работу с AI удобной для реальных задач"

**Mission**

- "Сделать современные AI‑модели доступными без сложных настроек."

**Values (3 cards)**

- Безопасность
- Надёжность
- Поддержка

**CTA**

- "Начать бесплатно"

### Imagery

- Use a product UI collage, not team stock.
- Remove public stats until real data exists.

---

## 5) /contact

### Goal

Fast support access with minimal friction.

### Block Plan + Wording

**Hero**

- H1: "Свяжитесь с нами"
- Subhead: "Отвечаем быстро и по делу"

**Contact info**

- Email: support@airis.you
- “Ответ в течение 24 часов” (if true)

**Simple form**

- Name / Email / Message

### Imagery

- Minimal. Optional small UI iconography.

---

## 6) /privacy

### Goal

Make legal text readable and trustworthy.

### Block Plan + Wording

**Summary block (top)**

- "Коротко: какие данные собираем, зачем и как защищаем."
- 3 bullets only.

**Main legal text**

- Update legal entity: ИП Шишеня Ян Александрович

### Imagery

- None. Keep clean and official.

---

## 7) /terms

### Goal

Clarity and compliance.

### Block Plan + Wording

**Summary block (top)**

- "Коротко: правила использования, оплата, ответственность."
- 3 bullets only.

**Main legal text**

- Update legal entity: ИП Шишеня Ян Александрович

### Imagery

- None. Keep clean and official.

---

# Execution Order

1. /welcome (core value + free start)
2. /features (capabilities summary)
3. /pricing (PAYG + dynamic quotas + examples)
4. /about (mission + values)
5. /contact (support path)
6. /privacy
7. /terms

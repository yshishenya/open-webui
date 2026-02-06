# Landing (/welcome) pricing: show model rate cards

## Meta

- Type: bugfix
- Status: done
- Owner: Codex
- Branch: airis_b2c
- Created: 2026-02-05
- Updated: 2026-02-05

## Context

На лендинге (`/welcome`) в секции «Оплата / Тарифы» показывался только текст + блок «Бесплатный старт» (квоты),
но не отображались цены на модели (public rate-cards). Пользователи ожидают видеть ставки прямо на лендинге без
перехода на отдельную страницу.

## Goal / Acceptance Criteria

- [ ] В секции `#pricing` на `/welcome` отображается таблица ставок по моделям (rate-cards) и цены.
- [ ] Данные подтягиваются из public API (`/api/v1/billing/public/rate-cards` + `/api/v1/billing/public/pricing-config`).
- [ ] Есть состояние загрузки/ошибки (грейсфул деградация).
- [ ] Есть ссылка/CTA на полную страницу тарифов (`/pricing`).
- [ ] Добавлен регрессионный e2e-тест, чтобы не потерять секцию снова.

## Non-goals

- Переработка страницы `/pricing` или бекенда rate-cards.
- Изменение схемы тарифов/юнитов/прайсинга.

## Scope (what changes)

- Backend:
  - N/A
- Frontend:
  - `src/lib/components/landing/WelcomePricingSection.svelte`: добавить загрузку public rate-cards и отображение таблицы ставок.
- Config/Env:
  - N/A
- Data model / migrations:
  - N/A

## Implementation Notes

- Key files/entrypoints:
  - `src/lib/components/landing/WelcomePricingSection.svelte`
  - `src/lib/apis/billing/index.ts` (используем существующие `getPublicRateCards` / `getPublicPricingConfig`)
- Edge cases:
  - public API недоступно → показываем user-safe сообщение.
  - пустой список моделей → таблица показывает empty-state.

## Upstream impact

- Upstream-owned files touched:
  - `src/lib/components/landing/WelcomePricingSection.svelte`
  - `e2e/welcome_hero.spec.ts`
- Why unavoidable:
  - Секция лендинга не отображала rate-cards вообще.
- Minimization strategy:
  - Переиспользуем существующий UI-компонент `RatesTable` и existing public API, без изменений контрактов/эндпоинтов.

## Verification

- Frontend tests: `npm run test:frontend -- --run`
- E2E (compile/list): `npx playwright test e2e/welcome_hero.spec.ts --list`
- Notes:
  - `npm run check` currently fails due to pre-existing TypeScript issues in unrelated files (not introduced here).

## Task Entry (for branch_updates/current_tasks)

- [x] **[BUG]** Landing pricing: show model prices (rate-cards) on `/welcome`
  - Spec: `meta/memory_bank/specs/work_items/2026-02-05__bugfix__welcome-pricing-rate-cards.md`
  - Owner: Codex
  - Done: 2026-02-05
  - Summary: Add public rate-cards table to the landing pricing section so model prices are visible without leaving `/welcome`.
  - Tests: `npm run test:frontend -- --run`, `npx playwright test e2e/welcome_hero.spec.ts --list`
  - Risks: Low (read-only public fetch; graceful empty/error states)

## Risks / Rollback

- Risks:
  - Доп. публичные запросы на `/welcome` (rate-cards + pricing-config) могут добавить небольшую задержку на лендинге.
- Rollback plan:
  - Revert commit; секция вернётся к прежнему статическому виду.

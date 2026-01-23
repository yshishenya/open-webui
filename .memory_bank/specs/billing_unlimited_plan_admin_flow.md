# Billing Unlimited Plan (Admin-Only) + Free Plan Removal

Status: approved for implementation (2026-01-23)

## Goals
- Remove free plan activation and auto-assignment.
- Keep subscriptions as admin-only tooling for privileged/unlimited access.
- Use quotas = null to represent unlimited access.
- Keep PAYG + lead magnet as the default user billing flow.

## Decisions
- /billing/plans is admin-only.
- Unlimited plan display label: "Безлимит".
- Unlimited is represented by plan.quotas = null (no numeric limits).
- Free plan endpoints, UI, and logic are removed.

## UX Summary
- User billing dashboard shows wallet + lead magnet.
- If user has an admin-assigned unlimited subscription, show a top badge "Безлимит".
- Plans page is hidden for non-admins.
- Admin plans list supports a filter for unlimited plans (quotas = null).

## Backend Changes
- Remove POST /billing/subscription/free and ActivateFreePlanRequest.
- Remove BillingService.activate_free_plan.
- Remove Plans.get_free_plan and Subscriptions.assign_free_plan_to_user.
- Ensure quota enforcement treats None as unlimited.

## Frontend Changes
- Remove activateFreePlan API + UI.
- Restrict /billing/plans to admin users only.
- Add "Безлимит" badge at top of /billing/dashboard when plan quotas are null.
- Format quota display to show unlimited (no percent) when limit is null.

## Tests
- Remove free plan tests.
- Add coverage for quota = null handling (unlimited).

## Docs
- Remove free plan references from BILLING_SETUP.md and b2c_monetization_plan.
- Update current_tasks.md to link this plan.

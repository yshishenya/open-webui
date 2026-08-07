# Public landing session CTA fallback

Status: done
Type: bug fix

## Problem

Public pages render without waiting for backend bootstrap, but an existing token can leave the session store empty briefly. Landing CTAs then send an authenticated user to signup.

## Change

- Hydrate an existing public-page session asynchronously without blocking first paint.
- Treat an existing browser token as an authenticated CTA fallback until hydration completes.
- Include the legacy `/prices` route in the public allowlist.

## Acceptance criteria

- [x] Public routes still render without backend bootstrap.
- [x] Authenticated CTA navigation goes to chat during session hydration.
- [x] `/prices` does not wait for backend bootstrap.
- [x] Targeted landing tests and lint pass.

## Validation

- `npx eslint src/routes/+layout.svelte src/lib/components/landing/welcomeNavigation.ts src/lib/components/landing/welcomeNavigation.test.ts src/lib/utils/airis/public_routes.ts src/lib/utils/airis/public_routes.test.ts`
- `npx vitest run src/lib/components/landing/welcomeNavigation.test.ts src/lib/components/landing/welcomeLandingLinks.test.ts src/lib/utils/airis/public_routes.test.ts` (10 passed)
- `git diff --check`

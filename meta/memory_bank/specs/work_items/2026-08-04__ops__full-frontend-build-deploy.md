# Full frontend build and production rollout

## Meta

- Type: ops/deploy
- Status: blocked
- Owner: Codex
- Branch: codex/bugfix/lead-magnet-access-grants-v011-20260804
- Created: 2026-08-04
- Updated: 2026-08-04

## Goal

Build the complete Svelte/Vite frontend from the production-compatible source, package it with the verified backend hotfix image, and recreate only the `airis` service while preserving PostgreSQL, volumes, secrets, users, settings, model catalog, and billing data.

## Safety constraints

- Build must run in a disposable container with bounded CPU and memory.
- PostgreSQL and its volumes must not be recreated or modified.
- The known production image `yshishenya/yshishenya:be4f6ea84-hotfix` must remain available for rollback.
- Rollout requires a successful build, artifact verification, a fresh database backup, stable health, and read-only billing/model smoke checks.

## Evidence

- Baseline before build: `airis` healthy, restart count `0`; PostgreSQL untouched; host had 5.8 GiB RAM and no swap.
- Attempt 1: isolated `npm run build`, Node heap 1.5 GiB, container limit 3 GiB; Vite reached bundle generation and exited with JavaScript heap out-of-memory.
- Attempt 2: isolated `npm run build`, Node heap 2 GiB, container limit 3.5 GiB; host available memory fell to about 100 MiB during client bundle generation, so the builder was stopped before it could endanger production.
- Recovery: temporary builder and dependency volume removed; `airis` remains `yshishenya/yshishenya:be4f6ea84-hotfix`, healthy, restart count `0`; `/health` returns `{"status":true}`.

## Acceptance criteria

- [ ] Complete frontend build exits successfully and produces a verified `build` artifact.
- [ ] Frontend artifact is packaged over the unchanged verified backend image with a unique tag.
- [ ] Fresh PostgreSQL backup is created before service recreation.
- [ ] Only `airis` is recreated; PostgreSQL, volumes, and environment remain unchanged.
- [ ] Local/public health, frontend version metadata, authenticated browser readiness, model visibility, and billing endpoints pass after rollout.

## Blocker / next action

The production host has no swap and insufficient headroom for the full Vite bundle. Continue only after explicit approval to provision narrowly scoped temporary swap (fully removed after build) or move the build to a larger host/CI runner.

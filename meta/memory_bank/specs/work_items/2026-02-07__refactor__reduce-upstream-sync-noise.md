# [REFACTOR] Reduce Upstream Sync Noise (Prune Qoder Wiki + Thin Hook For Billing Bootstrap)

## Meta

- Type: refactor
- Status: done
- Owner: Codex
- Branch: `codex/prune-qoder`
- Created: 2026-02-07
- Updated: 2026-02-07

## Context

The fork accumulated large generated artifacts under `.qoder/` (repowiki dumps) that:

- add megabytes of noise to the fork diff vs upstream
- slow down reviews, grepping, and CI checkout
- provide little value compared to curated docs under `docs/` / `.memory_bank/`

Separately, `backend/open_webui/main.py` had a large inlined billing bootstrap block
that increases merge-conflict surface area during upstream syncs.

## Goals / Acceptance Criteria

- Remove large generated `.qoder` wiki artifacts from the repo history (keep small curated `.qoder/*.md` if still referenced).
- Prevent accidental re-adding of generated artifacts.
- Reduce conflict surface area in `backend/open_webui/main.py` by delegating billing bootstrap to an Airis-owned helper.
- Keep runtime behavior unchanged.

## Non-goals

- Changing billing behavior, pricing rules, or seed contents.
- Migrating all docs out of `.qoder/` (we only prune large generated dumps).

## Changes

### Repo hygiene

- Stop tracking:
  - `.qoder/repowiki/**`
  - `.qoder/quests/**`
- Keep:
  - `.qoder/RUSSIAN_OAUTH_SETUP.md` and other small `.qoder/*.md` still referenced by docs.
- Add `.gitignore` entries to prevent re-adding:
  - `.qoder/repowiki/`
  - `.qoder/quests/`
  - `specs/` (local SDD toolkit artifacts; repo uses `meta/sdd/specs/` as the source of truth)

### Thin hook (reduce upstream sync conflicts)

- Add Airis-owned helper:
  - `backend/open_webui/utils/airis/billing_init.py`
- Replace inlined bootstrap in upstream-owned:
  - `backend/open_webui/main.py`
  - with a minimal `await init_billing_on_startup()` call.

## Upstream impact

- Upstream-owned files touched:
  - `.gitignore` (small additive ignores)
  - `backend/open_webui/main.py` (replace large block with thin hook)
- Minimization strategy:
  - new logic lives in `backend/open_webui/utils/airis/billing_init.py`
  - upstream-owned file only imports + awaits the helper (no refactors beyond the moved block)

## Verification

- Backend tests:
  - `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc "pytest -q open_webui/test/util/test_safe_get.py open_webui/test/util/test_task_error_payload.py open_webui/test/util/test_chat_direct_ack.py"`

## Risks / Rollback

- Risks:
  - Low: behavior should be equivalent (moved code, same env gating).
- Rollback:
  - Revert the two commits:
    - `chore(repo): prune qoder-generated docs`
    - `refactor(billing): extract startup bootstrap into airis helper`


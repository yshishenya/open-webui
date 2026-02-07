- Status: done
- Spec: `meta/memory_bank/specs/work_items/2026-02-07__refactor__reduce-upstream-sync-noise.md`
- Branch: `codex/prune-qoder`

Summary:
- Pruned `.qoder/repowiki/**` and `.qoder/quests/**` from git to reduce fork noise.
- Extracted billing bootstrap from `backend/open_webui/main.py` into `backend/open_webui/utils/airis/billing_init.py` (thin hook).
- Added `.gitignore` entries to prevent re-adding generated artifacts.

Verification:
- Backend (docker): `pytest -q open_webui/test/util/test_safe_get.py open_webui/test/util/test_task_error_payload.py open_webui/test/util/test_chat_direct_ack.py`


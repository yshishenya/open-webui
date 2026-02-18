- [x] **[BUG][ACCESS]** Recheck and fix model access AttributeError on free model path
  - Spec: `meta/memory_bank/specs/work_items/2026-02-18__bugfix__model-access-control-attributeerror-recheck.md`
  - Owner: Codex
  - Branch: `codex/bugfix/model-access-control-attributeerror-recheck`
  - Done: 2026-02-18
  - Summary: Reproduced `access_control` AttributeError in user access path, confirmed user recreation is not a root-cause fix, and corrected guarded access fallback logic without breaking billing/public pricing flows.
  - Tests: `python -m py_compile backend/open_webui/routers/openai.py backend/open_webui/routers/ollama.py backend/open_webui/routers/models.py backend/open_webui/routers/billing.py`, `DATABASE_URL=sqlite:////tmp/openwebui_test_recheck.db .venv/bin/python -m pytest backend/open_webui/test/apps/webui/routers/test_models.py backend/open_webui/test/apps/webui/routers/test_billing_public_pricing.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py backend/open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py`
  - Risks: Low-Medium (shared access checks in critical request paths).

## 2026-02-18 16:22 — CI remediation pass
- Identified CI failures on PR #66: `Lint Backend` and `sdd-validate`.
- Removed `backend/open_webui/routers/ollama.py` from effective PR diff by reverting branch-local fallback edits in that upstream-owned file.
- Renamed SDD spec to compliant id format and added missing `metadata.work_item_spec`:
  - `meta/sdd/specs/completed/model-access-control-2026-02-18-001.json`
- Updated work item spec reference to the renamed SDD file.
- Next: push fix and re-check PR bot results after wait window.
Spec: meta/memory_bank/specs/work_items/2026-02-18__bugfix__model-access-control-attributeerror-recheck.md

## 2026-02-18 16:27 — Lint follow-up
- CI `Lint Backend` still failed due to 4 Ruff findings in `backend/open_webui/routers/models.py`.
- Applied minimal lint-only cleanup:
  - removed unused imports: `json`, `asyncio`, `ModelListResponse`
  - changed `except Exception as e:` to `except Exception:`
- Local check: `ruff check backend/open_webui/routers/models.py`.
Spec: meta/memory_bank/specs/work_items/2026-02-18__bugfix__model-access-control-attributeerror-recheck.md

## 2026-02-18 16:08 — Bot-feedback refactor pass
- Applied non-behavioral refactor to reduce duplicated access fallback construction.
- Added helper `get_model_access_kwargs(...)` in:
  - `backend/open_webui/routers/models.py`
  - `backend/open_webui/routers/openai.py`
- Replaced repeated inline fallback dict blocks with helper calls in touched access-check paths.
- Rationale: address maintainability bot feedback while preserving legacy access semantics.
Spec: meta/memory_bank/specs/work_items/2026-02-18__bugfix__model-access-control-attributeerror-recheck.md

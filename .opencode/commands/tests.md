---
description: Run repo tests (backend + frontend)
agent: build
---

Run the relevant test suite(s) for this repo:

- Backend: `pytest`
- Frontend: `npm run test:frontend`

If something fails, fix only issues related to the current change; for pre-existing failures, report them with the failing command + key error lines.

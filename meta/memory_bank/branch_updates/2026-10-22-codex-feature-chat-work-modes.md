- [x] **[FEATURE][CHAT]** Add explicit Russian Chat and Work modes
  - Spec: `meta/memory_bank/specs/work_items/2026-10-22__feature__chat-work-modes.md`
  - Owner: Codex
  - Branch: `codex/feature/chat-work-modes`
  - Started: 2026-10-22
  - Summary: Reuse the existing terminal selector and production environment; prefer configuration for naming and model defaults.
  - Progress: production naming/default configuration applied and verified; explicit selector implemented; 2615 frontend tests pass; release acceptance pending.

  - Follow-up: initial production/browser acceptance passed at c63de6eb38; now adding the requested ChatGPT-like selector and short explanations. No execution/configuration changes.

  - Completed: PR381 merged; reviewed source `0a310f3a6bc0e8ef2b4751fd38188da6687eb9b5` installed as `mode-hints-0a310f3a6b-20261022` (digest `sha256:7ef2ca9894d0afd27d65ca5e6aa3facffbbefa695ef16ada451a9d6bbd97e8c5`).
  - Validation: 2615 frontend tests, type/style/build checks, GitHub checks, image/package/resource/native parity, disposable PostgreSQL migration rehearsal and guarded deployment passed. Browser confirms descriptions, both transitions, repeat selection, persistence on reload and default Chat in a new conversation.
  - Operations: private backup verified on 2brain.dev; production environment, mounts, permanent services and mode configuration preserved. No new runtime, API, dependency or permissions. Final reports/screenshot retained; only owned temporary build material and verified redundant production copies are cleaned.

from __future__ import annotations

from pathlib import Path


def should_sync_frontend_static(
    *,
    static_dir: Path,
    open_webui_dir: Path,
    frontend_static_dir: Path,
) -> bool:
    """Decide whether it's safe/useful to sync frontend static assets into STATIC_DIR.

    `open_webui.config` performs a destructive "wipe + copy" into `STATIC_DIR` at import time.
    In a source checkout, the default `STATIC_DIR` points to `backend/open_webui/static`, which is
    git-tracked. We skip syncing in that case to avoid mutating the working tree.

    Additionally, when `frontend_static_dir` is missing, syncing would wipe `STATIC_DIR` but copy
    nothing, so we also skip in that case.
    """

    if not frontend_static_dir.exists():
        return False

    open_webui_static_dir = (open_webui_dir / "static").resolve()

    # `Path.is_relative_to` is available in Python 3.9+ (repo uses 3.11-3.12).
    targets_open_webui_static = static_dir.resolve().is_relative_to(open_webui_static_dir)
    if not targets_open_webui_static:
        return True

    # In a git worktree checkout `.git` is a file; `exists()` handles both file and directory.
    repo_root = open_webui_dir.parent.parent
    if (repo_root / ".git").exists():
        return False

    return True


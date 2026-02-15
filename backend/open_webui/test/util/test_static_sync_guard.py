from __future__ import annotations

from pathlib import Path

from open_webui.utils.airis.static_sync import should_sync_frontend_static


def _make_repo_layout(tmp_path: Path, *, with_git: bool) -> tuple[Path, Path]:
    base_dir = tmp_path / "repo"
    open_webui_dir = base_dir / "backend" / "open_webui"
    open_webui_dir.mkdir(parents=True, exist_ok=True)

    if with_git:
        (base_dir / ".git").write_text("gitdir: /tmp/fake\n", encoding="utf-8")

    return base_dir, open_webui_dir


def test_should_skip_when_target_is_git_tracked_static_in_source_checkout(tmp_path: Path) -> None:
    _base_dir, open_webui_dir = _make_repo_layout(tmp_path, with_git=True)

    static_dir = open_webui_dir / "static"
    static_dir.mkdir(parents=True, exist_ok=True)

    frontend_static_dir = tmp_path / "build" / "static"
    frontend_static_dir.mkdir(parents=True, exist_ok=True)

    assert (
        should_sync_frontend_static(
            static_dir=static_dir,
            open_webui_dir=open_webui_dir,
            frontend_static_dir=frontend_static_dir,
        )
        is False
    )


def test_should_sync_when_target_is_not_open_webui_static_and_build_exists(tmp_path: Path) -> None:
    base_dir, open_webui_dir = _make_repo_layout(tmp_path, with_git=True)

    static_dir = base_dir / "backend" / "data" / "static"
    frontend_static_dir = tmp_path / "build" / "static"
    frontend_static_dir.mkdir(parents=True, exist_ok=True)

    assert (
        should_sync_frontend_static(
            static_dir=static_dir,
            open_webui_dir=open_webui_dir,
            frontend_static_dir=frontend_static_dir,
        )
        is True
    )


def test_should_skip_when_build_static_missing(tmp_path: Path) -> None:
    base_dir, open_webui_dir = _make_repo_layout(tmp_path, with_git=True)

    static_dir = base_dir / "backend" / "data" / "static"
    frontend_static_dir = tmp_path / "build" / "static"

    assert (
        should_sync_frontend_static(
            static_dir=static_dir,
            open_webui_dir=open_webui_dir,
            frontend_static_dir=frontend_static_dir,
        )
        is False
    )


def test_should_sync_in_non_repo_environment_even_when_target_is_open_webui_static(
    tmp_path: Path,
) -> None:
    _base_dir, open_webui_dir = _make_repo_layout(tmp_path, with_git=False)

    static_dir = open_webui_dir / "static"
    frontend_static_dir = tmp_path / "build" / "static"
    frontend_static_dir.mkdir(parents=True, exist_ok=True)

    assert (
        should_sync_frontend_static(
            static_dir=static_dir,
            open_webui_dir=open_webui_dir,
            frontend_static_dir=frontend_static_dir,
        )
        is True
    )


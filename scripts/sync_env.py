#!/usr/bin/env python3
"""Sync one or more .env files with .env.example without leaking secrets.

This script treats `.env.example` as the canonical template:
- All keys present in `.env.example` will be present in the output `.env`.
- Existing values from the current `.env` are preserved (the script never overwrites
  a key's value with the example's default).
- Keys that exist in `.env` but not in `.env.example` can be kept (default) under a
  "Local overrides" section, so upgrades don't break custom deployments.

Designed to be safe for production usage:
- Creates a timestamped backup before modifying existing files (unless disabled).
- Prints only key names and counts, never values.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re
import sys


_KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class Assignment:
    key: str
    left: str
    right: str


def _parse_assignment(line: str) -> Assignment | None:
    if "=" not in line:
        return None

    left, right = line.split("=", 1)
    candidate = left.strip()
    if candidate.startswith("export "):
        candidate = candidate[len("export ") :].strip()

    if not _KEY_RE.match(candidate):
        return None

    return Assignment(key=candidate, left=left, right=right)


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def _load_env_values(env_file: Path) -> dict[str, str]:
    if not env_file.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in _read_text(env_file).splitlines():
        parsed = _parse_assignment(raw_line)
        if parsed is None:
            continue
        values[parsed.key] = parsed.right
    return values


def _load_template_lines(example_file: Path) -> tuple[list[str], set[str]]:
    lines = _read_text(example_file).splitlines()
    keys: set[str] = set()
    for line in lines:
        parsed = _parse_assignment(line)
        if parsed is not None:
            keys.add(parsed.key)
    return lines, keys


def _render_synced_env(
    *,
    template_lines: list[str],
    template_keys: set[str],
    existing_values: dict[str, str],
    keep_unknown_keys: bool,
) -> tuple[str, set[str], set[str], set[str]]:
    out_lines: list[str] = []
    preserved: set[str] = set()
    added: set[str] = set()
    missing_in_existing: set[str] = set()

    for line in template_lines:
        parsed = _parse_assignment(line)
        if parsed is None:
            out_lines.append(line)
            continue

        if parsed.key in existing_values:
            out_lines.append(f"{parsed.left}={existing_values[parsed.key]}")
            preserved.add(parsed.key)
        else:
            out_lines.append(line)
            missing_in_existing.add(parsed.key)

    if keep_unknown_keys:
        unknown_keys = sorted(k for k in existing_values.keys() if k not in template_keys)
        if unknown_keys:
            out_lines.extend(
                [
                    "",
                    "####################################",
                    "# Local overrides (not in .env.example)",
                    "####################################",
                ]
            )
            for key in unknown_keys:
                out_lines.append(f"{key}={existing_values[key]}")
                added.add(key)

    content = "\n".join(out_lines) + "\n"
    return content, preserved, missing_in_existing, added


def _backup_file(path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(f"{path.name}.bak.{timestamp}")
    backup_path.write_bytes(path.read_bytes())
    return backup_path


def _sync_one(
    *,
    env_file: Path,
    example_file: Path,
    template_lines: list[str],
    template_keys: set[str],
    dry_run: bool,
    keep_unknown_keys: bool,
    backup: bool,
) -> int:
    existing_values = _load_env_values(env_file)
    new_content, preserved, missing_in_existing, unknown_kept = _render_synced_env(
        template_lines=template_lines,
        template_keys=template_keys,
        existing_values=existing_values,
        keep_unknown_keys=keep_unknown_keys,
    )

    old_content = _read_text(env_file) if env_file.exists() else ""
    changed = old_content != new_content

    print(f"== {env_file} ==")
    print(f"Template: {example_file}")
    print(f"Keys preserved from existing: {len(preserved)}")
    print(f"Keys added from template: {len(missing_in_existing)}")
    if keep_unknown_keys:
        print(f"Custom keys kept (not in template): {len(unknown_kept)}")
    if not changed:
        print("Status: already up to date")
        print()
        return 0

    if dry_run:
        print("Status: would update (dry-run)")
        print()
        return 0

    if env_file.exists() and backup:
        backup_path = _backup_file(env_file)
        print(f"Backup: {backup_path}")

    _write_text(env_file, new_content)
    print("Status: updated")
    print()
    return 0


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="sync_env.py",
        description="Sync .env files with .env.example (preserving existing values).",
    )
    parser.add_argument(
        "--example",
        default=".env.example",
        help="Path to the canonical template file (default: .env.example).",
    )
    parser.add_argument(
        "--env",
        action="append",
        dest="env_files",
        default=[],
        help="Path to an env file to sync (can be repeated). Default: .env",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write changes; print a safe summary only.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not create a backup when writing (not recommended).",
    )
    parser.add_argument(
        "--drop-unknown-keys",
        action="store_true",
        help="Do not keep keys that are not present in the template.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = _parse_args(argv)

    example_file = Path(args.example)
    if not example_file.exists():
        print(f"ERROR: missing template file: {example_file}", file=sys.stderr)
        return 2

    env_files = [Path(p) for p in (args.env_files or [".env"])]
    template_lines, template_keys = _load_template_lines(example_file)

    status = 0
    for env_file in env_files:
        status = max(
            status,
            _sync_one(
                env_file=env_file,
                example_file=example_file,
                template_lines=template_lines,
                template_keys=template_keys,
                dry_run=bool(args.dry_run),
                keep_unknown_keys=not bool(args.drop_unknown_keys),
                backup=not bool(args.no_backup),
            ),
        )
    return status


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))


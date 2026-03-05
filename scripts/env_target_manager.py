#!/usr/bin/env python3
"""Manage environment key drift across deploy targets.

Targets are configured via local (gitignored) files:
  .env.deploy.<target>

Each target config should contain at least:
  PROD_HOST=...
  PROD_SSH_USER=...   # optional, defaults to current SSH user
  PROD_PATH=...
Optional:
  PROD_SSH_PORT=...
  PROD_SSH_KEY=~/.ssh/...
  TARGET_ENV_PATH=.env   # default is <PROD_PATH>/.env

Examples are tracked in:
  deploy/targets/<target>.env.example
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import os
from pathlib import Path
import posixpath
import re
import shlex
import subprocess
import sys

KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
ASSIGNMENT_PATTERN = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$")
TARGET_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass(frozen=True)
class TargetConfig:
    name: str
    config_path: Path
    host: str
    ssh_user: str | None
    prod_path: str
    env_path: str
    ssh_port: str | None
    ssh_key: Path | None


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _parse_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}

    for raw_line in _read_text(path).splitlines():
        stripped_line = raw_line.strip()
        if not stripped_line or stripped_line.startswith("#"):
            continue

        match = ASSIGNMENT_PATTERN.match(raw_line)
        if match is None:
            continue

        key = match.group(1)
        value_source = match.group(2)

        lexer = shlex.shlex(value_source, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = "#"

        try:
            tokens = list(lexer)
        except ValueError:
            continue

        if not tokens:
            value = ""
        elif len(tokens) == 1:
            value = tokens[0]
        else:
            # Invalid assignment with unquoted spaces; ignore.
            continue

        values[key] = value

    return values


def _extract_keys_from_text(content: str) -> set[str]:
    keys: set[str] = set()
    for raw_line in content.splitlines():
        match = ASSIGNMENT_PATTERN.match(raw_line)
        if match is None:
            continue
        key = match.group(1)
        if KEY_PATTERN.match(key):
            keys.add(key)
    return keys


def _resolve_project_root(cli_value: str | None) -> Path:
    if cli_value:
        return Path(cli_value).expanduser().resolve()

    script_dir = Path(__file__).resolve().parent
    return script_dir.parent


def _discover_template_targets(project_root: Path) -> set[str]:
    targets: set[str] = set()
    template_dir = project_root / "deploy" / "targets"
    if not template_dir.exists():
        return targets

    for template_file in template_dir.glob("*.env.example"):
        name = template_file.name.removesuffix(".env.example")
        if TARGET_NAME_PATTERN.match(name):
            targets.add(name)
    return targets


def _discover_local_targets(project_root: Path) -> set[str]:
    targets: set[str] = set()
    for config_file in project_root.glob(".env.deploy.*"):
        suffix = config_file.name.removeprefix(".env.deploy.")
        if not suffix or suffix.endswith(".local") or ".bak" in suffix:
            continue
        if TARGET_NAME_PATTERN.match(suffix):
            targets.add(suffix)
    return targets


def _require_target_name(target: str) -> None:
    if not TARGET_NAME_PATTERN.match(target):
        raise ValueError(f"Invalid target name: {target}")


def _target_config_path(project_root: Path, target: str) -> Path:
    return project_root / f".env.deploy.{target}"


def _target_template_path(project_root: Path, target: str) -> Path:
    return project_root / "deploy" / "targets" / f"{target}.env.example"


def _load_target_config(project_root: Path, target: str) -> TargetConfig:
    _require_target_name(target)

    config_path = _target_config_path(project_root, target)
    if not config_path.exists():
        template_path = _target_template_path(project_root, target)
        hint = f"Create {config_path}"
        if template_path.exists():
            hint += f" from {template_path}"
        raise FileNotFoundError(f"Missing target config: {config_path}. {hint}.")

    values = _parse_dotenv(config_path)

    host = values.get("PROD_HOST", "").strip()
    ssh_user = values.get("PROD_SSH_USER", "").strip() or None
    prod_path = values.get("PROD_PATH", "").strip()
    ssh_port = values.get("PROD_SSH_PORT", "").strip() or None
    ssh_key_raw = values.get("PROD_SSH_KEY", "").strip()

    if not host:
        raise ValueError(f"{config_path}: PROD_HOST is required")
    if not prod_path:
        raise ValueError(f"{config_path}: PROD_PATH is required")

    env_path_value = values.get("TARGET_ENV_PATH", ".env").strip() or ".env"
    if posixpath.isabs(env_path_value):
        env_path = posixpath.normpath(env_path_value)
    else:
        env_path = posixpath.normpath(posixpath.join(prod_path, env_path_value))

    ssh_key: Path | None = None
    if ssh_key_raw:
        ssh_key = Path(os.path.expanduser(ssh_key_raw))

    return TargetConfig(
        name=target,
        config_path=config_path,
        host=host,
        ssh_user=ssh_user,
        prod_path=prod_path,
        env_path=env_path,
        ssh_port=ssh_port,
        ssh_key=ssh_key,
    )


def _ssh_base_args(target: TargetConfig) -> list[str]:
    args = ["ssh"]
    if target.ssh_key is not None:
        args.extend(["-i", str(target.ssh_key)])
    if target.ssh_port is not None:
        args.extend(["-p", target.ssh_port])

    ssh_target = target.host
    if target.ssh_user:
        ssh_target = f"{target.ssh_user}@{target.host}"

    args.extend(
        [
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            "-o",
            "StrictHostKeyChecking=accept-new",
            ssh_target,
        ]
    )
    return args


def _run_ssh(target: TargetConfig, remote_script: str) -> subprocess.CompletedProcess[str]:
    remote_command = f"bash -lc {shlex.quote(remote_script)}"
    command = _ssh_base_args(target) + [remote_command]
    return subprocess.run(command, text=True, capture_output=True, check=False)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_obj:
        while True:
            chunk = file_obj.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _remote_template_hash(target: TargetConfig) -> tuple[bool, str]:
    remote_cmd = (
        f"cd {shlex.quote(target.prod_path)} && "
        "if [ ! -f .env.example ]; then echo 'Missing .env.example in project path' >&2; exit 6; fi && "
        "sha256sum .env.example | awk '{print $1}'"
    )
    result = _run_ssh(target, remote_cmd)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip() or "<no stderr>"
        return False, stderr

    hash_value = (result.stdout or "").strip()
    if not re.match(r"^[a-f0-9]{64}$", hash_value):
        return False, f"Unexpected hash output: {hash_value}"
    return True, hash_value


def _load_template_keys(example_path: Path) -> set[str]:
    if not example_path.exists():
        raise FileNotFoundError(f"Missing template file: {example_path}")
    return _extract_keys_from_text(_read_text(example_path))


def _check_target(target: TargetConfig, template_keys: set[str]) -> tuple[bool, str]:
    remote_cmd = (
        f"if [ -f {shlex.quote(target.env_path)} ]; then "
        f"cat {shlex.quote(target.env_path)}; "
        f"else echo 'Missing env file: {target.env_path}' >&2; exit 3; fi"
    )

    result = _run_ssh(target, remote_cmd)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip() or "<no stderr>"
        return False, f"ERROR: SSH/read failed for target '{target.name}': {stderr}"

    remote_keys = _extract_keys_from_text(result.stdout)
    missing = sorted(template_keys - remote_keys)
    extra = sorted(remote_keys - template_keys)

    lines = [
        f"== {target.name} ==",
        f"Config: {target.config_path}",
        f"Host: {target.host}",
        f"Remote env: {target.env_path}",
        f"Template keys: {len(template_keys)}",
        f"Remote keys: {len(remote_keys)}",
        f"Missing keys: {len(missing)}",
        f"Extra keys: {len(extra)}",
    ]

    if missing:
        lines.append("Missing list:")
        lines.extend([f"  - {key}" for key in missing])
    if extra:
        lines.append("Extra list:")
        lines.extend([f"  - {key}" for key in extra])

    is_clean = not missing and not extra
    if is_clean:
        lines.append("Status: OK")
    else:
        lines.append("Status: DRIFT")

    return is_clean, "\n".join(lines)


def _sync_target(
    target: TargetConfig,
    *,
    dry_run: bool,
    local_template_hash: str,
    allow_template_mismatch: bool,
) -> tuple[bool, str]:
    hash_ok, remote_hash_or_error = _remote_template_hash(target)
    if not hash_ok:
        return False, f"== {target.name} ==\nERROR: failed to read remote .env.example hash: {remote_hash_or_error}"

    remote_template_hash = remote_hash_or_error
    if remote_template_hash != local_template_hash and not allow_template_mismatch:
        return False, (
            f"== {target.name} ==\n"
            "ERROR: template hash mismatch between local and remote.\n"
            f"  local  .env.example: {local_template_hash}\n"
            f"  remote .env.example: {remote_template_hash}\n"
            "Run `git pull --ff-only` on target repo first or re-run with --allow-template-mismatch."
        )

    sync_args = [
        "scripts/sync_env.py",
        "--example",
        ".env.example",
        "--env",
        target.env_path,
    ]
    if dry_run:
        sync_args.append("--dry-run")

    quoted_sync_cmd = " ".join(shlex.quote(item) for item in sync_args)

    remote_cmd = (
        f"cd {shlex.quote(target.prod_path)} && "
        "if [ ! -f scripts/sync_env.py ]; then "
        "echo 'Missing scripts/sync_env.py in project path' >&2; exit 4; fi && "
        "if command -v python3 >/dev/null 2>&1; then PY=python3; "
        "elif command -v python >/dev/null 2>&1; then PY=python; "
        "else echo 'Missing python3/python on target host' >&2; exit 5; fi && "
        f"$PY {quoted_sync_cmd}"
    )

    result = _run_ssh(target, remote_cmd)

    output_lines = [
        f"== {target.name} ==",
        f"Config: {target.config_path}",
        f"Host: {target.host}",
        f"Remote env: {target.env_path}",
        f"Template hash (local): {local_template_hash}",
        f"Template hash (remote): {remote_template_hash}",
    ]

    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()

    if stdout:
        output_lines.append("Output:")
        output_lines.extend([f"  {line}" for line in stdout.splitlines()])

    if result.returncode != 0:
        if stderr:
            output_lines.append("Error:")
            output_lines.extend([f"  {line}" for line in stderr.splitlines()])
        return False, "\n".join(output_lines)

    output_lines.append("Status: OK")
    return True, "\n".join(output_lines)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="env_target_manager.py",
        description="Check/sync .env key drift on remote deploy targets.",
    )
    parser.add_argument(
        "--project-root",
        default="",
        help="Path to repository root (default: parent dir of this script).",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="List discovered targets.")
    list_parser.set_defaults(command="list")

    check_parser = subparsers.add_parser("check", help="Compare remote env keys vs .env.example.")
    check_parser.add_argument("--target", action="append", default=[], help="Target name (repeatable).")
    check_parser.add_argument("--example", default=".env.example", help="Template file path relative to project root.")
    check_parser.add_argument(
        "--allow-drift",
        action="store_true",
        help="Exit 0 even if drift is found.",
    )

    sync_parser = subparsers.add_parser("sync", help="Run remote sync_env.py for target env files.")
    sync_parser.add_argument("--target", action="append", default=[], help="Target name (repeatable).")
    sync_parser.add_argument("--dry-run", action="store_true", help="Pass --dry-run to remote sync_env.py.")
    sync_parser.add_argument(
        "--allow-template-mismatch",
        action="store_true",
        help="Allow sync even when local and remote .env.example hashes differ.",
    )

    return parser.parse_args(argv)


def _resolve_targets(project_root: Path, requested: list[str]) -> list[str]:
    if requested:
        for target in requested:
            _require_target_name(target)
        return sorted(set(requested))

    local_targets = _discover_local_targets(project_root)
    if not local_targets:
        raise RuntimeError(
            "No local target configs found (.env.deploy.<target>). "
            "Create from deploy/targets/<target>.env.example first."
        )
    return sorted(local_targets)


def _handle_list(project_root: Path) -> int:
    templates = _discover_template_targets(project_root)
    locals_ = _discover_local_targets(project_root)
    all_targets = sorted(templates | locals_)

    if not all_targets:
        print("No targets discovered.")
        print("Add templates in deploy/targets/*.env.example and local configs .env.deploy.<target>.")
        return 0

    for target in all_targets:
        local_mark = "yes" if target in locals_ else "no"
        template_mark = "yes" if target in templates else "no"
        print(f"{target}: local_config={local_mark}, template={template_mark}")
    return 0


def _handle_check(project_root: Path, args: argparse.Namespace) -> int:
    targets = _resolve_targets(project_root, args.target)
    example_path = (project_root / args.example).resolve()
    template_keys = _load_template_keys(example_path)

    had_errors = False
    had_drift = False

    for target_name in targets:
        try:
            target = _load_target_config(project_root, target_name)
        except (FileNotFoundError, ValueError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            had_errors = True
            continue

        is_clean, output = _check_target(target, template_keys)
        print(output)
        print()

        if output.startswith("ERROR:"):
            had_errors = True
        elif not is_clean:
            had_drift = True

    if had_errors:
        return 2
    if had_drift and not bool(args.allow_drift):
        return 1
    return 0


def _handle_sync(project_root: Path, args: argparse.Namespace) -> int:
    targets = _resolve_targets(project_root, args.target)
    had_errors = False
    local_template_path = (project_root / ".env.example").resolve()
    if not local_template_path.exists():
        print(f"ERROR: missing local template: {local_template_path}", file=sys.stderr)
        return 2

    local_template_hash = _file_sha256(local_template_path)

    for target_name in targets:
        try:
            target = _load_target_config(project_root, target_name)
        except (FileNotFoundError, ValueError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            had_errors = True
            continue

        ok, output = _sync_target(
            target,
            dry_run=bool(args.dry_run),
            local_template_hash=local_template_hash,
            allow_template_mismatch=bool(args.allow_template_mismatch),
        )
        print(output)
        print()

        if not ok:
            had_errors = True

    return 2 if had_errors else 0


def main(argv: list[str]) -> int:
    args = _parse_args(argv)
    project_root = _resolve_project_root(args.project_root)

    if args.command == "list":
        return _handle_list(project_root)
    if args.command == "check":
        return _handle_check(project_root, args)
    if args.command == "sync":
        return _handle_sync(project_root, args)

    print(f"Unknown command: {args.command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

"""Fail on new Ruff diagnostics; retain existing diagnostics on unchanged lines."""

from __future__ import annotations

import argparse
import difflib
import json
import subprocess
from collections import Counter
from pathlib import Path
from typing import TypedDict


class Location(TypedDict):
    row: int
    column: int


class Diagnostic(TypedDict):
    filename: str
    code: str
    message: str
    location: Location


def unchanged_lines(before: str, after: str) -> dict[int, int]:
    """Map current one-based line numbers to identical base lines, without reuse."""
    result: dict[int, int] = {}
    matcher = difflib.SequenceMatcher(None, before.splitlines(), after.splitlines(), autojunk=False)
    for base_start, current_start, size in matcher.get_matching_blocks():
        for offset in range(size):
            result[current_start + offset + 1] = base_start + offset + 1
    return result


def new_diagnostics(before: list[Diagnostic], after: list[Diagnostic], mapping: dict[int, int]) -> list[Diagnostic]:
    """A base diagnostic can exempt exactly one diagnostic on its unchanged line."""
    existing = Counter((d['code'], d['message'], d['location']['row'], d['location']['column']) for d in before)
    added: list[Diagnostic] = []
    for diagnostic in after:
        location = diagnostic['location']
        base_row = mapping.get(location['row'])
        key = diagnostic['code'], diagnostic['message'], base_row, location['column']
        if existing[key] > 0:
            existing[key] -= 1
        else:
            added.append(diagnostic)
    return added


def lint(paths: list[str], *, cwd: Path, config: Path) -> list[Diagnostic]:
    if not paths:
        return []
    result = subprocess.run(
        ['ruff', 'check', '--config', str(config), '--output-format=json', *paths],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode not in {0, 1}:
        raise RuntimeError(f'Ruff failed: {result.stderr}')
    diagnostics: list[Diagnostic] = json.loads(result.stdout)
    return diagnostics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('files', nargs='+')
    args = parser.parse_args()
    root = Path.cwd()
    paths = args.files
    for path in paths:
        if not path.startswith('backend/') or not path.endswith('.py') or '..' in Path(path).parts:
            raise ValueError(f'Invalid backend path: {path}')
    output: Path = args.output
    output.mkdir(parents=True, exist_ok=True)
    current = lint(paths, cwd=root, config=root / 'pyproject.toml')
    added: list[Diagnostic] = []
    baseline: list[Diagnostic] = []
    base_root: Path = args.base_dir.resolve()
    if not (base_root / 'pyproject.toml').is_file():
        raise ValueError('Missing base pyproject.toml')
    before_sources = {path: (base_root / path).read_text() for path in paths if (base_root / path).is_file()}
    baseline = lint(list(before_sources), cwd=base_root, config=base_root / 'pyproject.toml')
    for path in paths:
        previous = [d for d in baseline if Path(d['filename']) == base_root / path]
        present = [d for d in current if Path(d['filename']) == root / path]
        line_map = unchanged_lines(before_sources.get(path, ''), (root / path).read_text())
        added.extend(new_diagnostics(previous, present, line_map))
    for name, diagnostics in [('baseline', baseline), ('current', current), ('new', added)]:
        (output / f'{name}.json').write_text(json.dumps(diagnostics, indent=2) + '\n')
    print(f'Backend Ruff: {len(current)} current, {len(baseline)} base, {len(added)} new diagnostics')
    for diagnostic in added:
        location = diagnostic['location']
        print(
            f"{diagnostic['filename']}:{location['row']}:{location['column']}: "
            f"{diagnostic['code']} {diagnostic['message']}"
        )
    return 1 if added else 0


if __name__ == '__main__':
    raise SystemExit(main())

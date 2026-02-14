#!/usr/bin/env python3
"""Validate billing module coverage thresholds from a coverage.py JSON report."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModuleThreshold:
    """Coverage thresholds for one module."""

    module_path: str
    line_min: float
    branch_min: float


def _read_threshold(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default
    try:
        parsed = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be a number, got: {raw_value}") from exc
    if parsed < 0 or parsed > 100:
        raise ValueError(f"Environment variable {name} must be within [0, 100], got: {raw_value}")
    return parsed


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Check module-scoped line and branch coverage for billing critical modules. "
            "Defaults are release floors and can be overridden via flags or environment."
        )
    )
    parser.add_argument(
        "--coverage-json",
        required=True,
        help="Path to coverage.py JSON report generated via --cov-report=json:<path>.",
    )
    parser.add_argument(
        "--routers-line-min",
        type=float,
        default=_read_threshold("BILLING_COVERAGE_MIN_ROUTERS_LINE", 85.0),
        help="Minimum line coverage percentage for open_webui/routers/billing.py.",
    )
    parser.add_argument(
        "--routers-branch-min",
        type=float,
        default=_read_threshold("BILLING_COVERAGE_MIN_ROUTERS_BRANCH", 65.0),
        help="Minimum branch coverage percentage for open_webui/routers/billing.py.",
    )
    parser.add_argument(
        "--utils-line-min",
        type=float,
        default=_read_threshold("BILLING_COVERAGE_MIN_UTILS_LINE", 85.0),
        help="Minimum line coverage percentage for open_webui/utils/billing.py.",
    )
    parser.add_argument(
        "--utils-branch-min",
        type=float,
        default=_read_threshold("BILLING_COVERAGE_MIN_UTILS_BRANCH", 70.0),
        help="Minimum branch coverage percentage for open_webui/utils/billing.py.",
    )
    return parser


def _resolve_module_entry(files_data: dict[str, object], module_path: str) -> dict[str, object] | None:
    if module_path in files_data:
        entry = files_data[module_path]
        if isinstance(entry, dict):
            return entry
        return None

    for candidate_path, entry in files_data.items():
        if not isinstance(candidate_path, str) or not isinstance(entry, dict):
            continue
        if candidate_path.endswith(module_path):
            return entry
    return None


def _validate_percent(name: str, value: float) -> None:
    if value < 0 or value > 100:
        raise ValueError(f"{name} must be within [0, 100], got {value}")


def _extract_summary_metrics(module_path: str, entry: dict[str, object]) -> tuple[float, float]:
    summary_obj = entry.get("summary")
    if not isinstance(summary_obj, dict):
        raise ValueError(f"Coverage entry for {module_path} does not include a valid summary object")

    line_raw = summary_obj.get("percent_covered")
    branch_raw = summary_obj.get("percent_branches_covered")
    branches_count_raw = summary_obj.get("num_branches", 0)

    if not isinstance(line_raw, (int, float)):
        raise ValueError(f"Coverage summary for {module_path} has invalid percent_covered: {line_raw!r}")

    if not isinstance(branches_count_raw, int):
        raise ValueError(f"Coverage summary for {module_path} has invalid num_branches: {branches_count_raw!r}")

    if branches_count_raw == 0:
        branch_value = 100.0
    elif isinstance(branch_raw, (int, float)):
        branch_value = float(branch_raw)
    else:
        raise ValueError(
            f"Coverage summary for {module_path} has invalid percent_branches_covered: {branch_raw!r}"
        )

    line_value = float(line_raw)
    _validate_percent(f"{module_path} line coverage", line_value)
    _validate_percent(f"{module_path} branch coverage", branch_value)
    return line_value, branch_value


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    coverage_path = Path(args.coverage_json)
    if not coverage_path.exists():
        print(f"[billing-coverage-gate] coverage JSON file not found: {coverage_path}", file=sys.stderr)
        return 2

    try:
        payload = json.loads(coverage_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[billing-coverage-gate] invalid JSON in {coverage_path}: {exc}", file=sys.stderr)
        return 2

    files_data_obj = payload.get("files")
    if not isinstance(files_data_obj, dict):
        print(
            "[billing-coverage-gate] coverage JSON is missing a valid 'files' object",
            file=sys.stderr,
        )
        return 2

    module_thresholds = [
        ModuleThreshold(
            module_path="open_webui/routers/billing.py",
            line_min=args.routers_line_min,
            branch_min=args.routers_branch_min,
        ),
        ModuleThreshold(
            module_path="open_webui/utils/billing.py",
            line_min=args.utils_line_min,
            branch_min=args.utils_branch_min,
        ),
    ]

    failures: list[str] = []
    print("[billing-coverage-gate] module coverage results")
    for threshold in module_thresholds:
        module_entry = _resolve_module_entry(files_data_obj, threshold.module_path)
        if module_entry is None:
            failures.append(f"{threshold.module_path}: missing in coverage report")
            print(f"- {threshold.module_path}: MISSING")
            continue

        try:
            line_value, branch_value = _extract_summary_metrics(threshold.module_path, module_entry)
        except ValueError as exc:
            failures.append(f"{threshold.module_path}: {exc}")
            print(f"- {threshold.module_path}: INVALID ({exc})")
            continue

        line_ok = line_value >= threshold.line_min
        branch_ok = branch_value >= threshold.branch_min
        status = "PASS" if line_ok and branch_ok else "FAIL"
        print(
            f"- {threshold.module_path}: {status} "
            f"(line={line_value:.2f}% / min={threshold.line_min:.2f}%, "
            f"branch={branch_value:.2f}% / min={threshold.branch_min:.2f}%)"
        )
        if not line_ok:
            failures.append(
                f"{threshold.module_path}: line coverage {line_value:.2f}% "
                f"is below {threshold.line_min:.2f}%"
            )
        if not branch_ok:
            failures.append(
                f"{threshold.module_path}: branch coverage {branch_value:.2f}% "
                f"is below {threshold.branch_min:.2f}%"
            )

    if failures:
        print("[billing-coverage-gate] gate FAILED")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("[billing-coverage-gate] gate PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())

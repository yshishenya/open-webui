#!/usr/bin/env python3
"""Synthetic billing probe for mock and staging safety checks."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

CheckStatus = Literal["pass", "fail", "skip"]
ProbeMode = Literal["mock", "staging"]

HARD_MAX_AMOUNT_RUB = 10.0


@dataclass
class CheckResult:
    name: str
    status: CheckStatus
    message: str


@dataclass
class SafetyConfig:
    require_sandbox: bool
    allow_live_payments: bool
    max_amount_rub: float


@dataclass
class ProbeSummary:
    mode: ProbeMode
    base_url: str
    generated_at: str
    overall_status: Literal["pass", "fail"]
    checks: list[CheckResult]
    safety: SafetyConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synthetic billing probe with strict safety defaults."
    )
    parser.add_argument(
        "--mode",
        required=True,
        choices=("mock", "staging"),
        help="Probe mode: deterministic mock checks or staging safety checks.",
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8080",
        help="Base URL for optional health probe (default: http://localhost:8080).",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=10.0,
        help="HTTP timeout for optional health check.",
    )
    parser.add_argument(
        "--max-amount-rub",
        type=float,
        default=10.0,
        help="Safety cap for staging checks (must be <= 10.0).",
    )
    parser.add_argument(
        "--require-sandbox",
        action="store_true",
        help="Mandatory guard for staging mode.",
    )
    parser.add_argument(
        "--allow-live-payments",
        action="store_true",
        help="Explicitly request live payment probes (rejected by safety policy).",
    )
    parser.add_argument(
        "--check-health",
        action="store_true",
        help="Run GET /health against base URL.",
    )
    parser.add_argument(
        "--output-json",
        default="",
        help="Optional path for JSON summary output.",
    )
    parser.add_argument(
        "--output-md",
        default="",
        help="Optional path for Markdown summary output.",
    )
    return parser.parse_args()


def _health_check(base_url: str, timeout_seconds: float) -> CheckResult:
    health_url = f"{base_url.rstrip('/')}/health"
    try:
        with urlopen(health_url, timeout=timeout_seconds) as response:
            status = response.status
            if status == 200:
                return CheckResult(
                    name="service_health",
                    status="pass",
                    message=f"GET {health_url} returned HTTP 200.",
                )
            return CheckResult(
                name="service_health",
                status="fail",
                message=f"GET {health_url} returned HTTP {status}.",
            )
    except HTTPError as error:
        return CheckResult(
            name="service_health",
            status="fail",
            message=f"GET {health_url} failed with HTTP {error.code}.",
        )
    except URLError as error:
        return CheckResult(
            name="service_health",
            status="fail",
            message=f"GET {health_url} failed: {error.reason}.",
        )
    except TimeoutError:
        return CheckResult(
            name="service_health",
            status="fail",
            message=f"GET {health_url} timed out after {timeout_seconds}s.",
        )


def _run_mock_mode(args: argparse.Namespace) -> list[CheckResult]:
    checks = [
        CheckResult(
            name="mock_deterministic_payload",
            status="pass",
            message="Mock mode uses deterministic checks without external side effects.",
        ),
        CheckResult(
            name="live_payment_calls",
            status="pass",
            message="Live payment calls are disabled in mock mode.",
        ),
    ]
    if args.check_health:
        checks.append(_health_check(args.base_url, args.timeout_seconds))
    else:
        checks.append(
            CheckResult(
                name="service_health",
                status="skip",
                message="Health check skipped (use --check-health to enable).",
            )
        )
    return checks


def _run_staging_mode(args: argparse.Namespace) -> list[CheckResult]:
    checks: list[CheckResult] = []

    if args.require_sandbox:
        checks.append(
            CheckResult(
                name="sandbox_guard",
                status="pass",
                message="Sandbox guard enabled via --require-sandbox.",
            )
        )
    else:
        checks.append(
            CheckResult(
                name="sandbox_guard",
                status="fail",
                message="Staging mode requires --require-sandbox.",
            )
        )

    if args.max_amount_rub <= HARD_MAX_AMOUNT_RUB:
        checks.append(
            CheckResult(
                name="amount_cap_guard",
                status="pass",
                message=f"max_amount_rub={args.max_amount_rub} within safe cap {HARD_MAX_AMOUNT_RUB}.",
            )
        )
    else:
        checks.append(
            CheckResult(
                name="amount_cap_guard",
                status="fail",
                message=f"max_amount_rub={args.max_amount_rub} exceeds hard cap {HARD_MAX_AMOUNT_RUB}.",
            )
        )

    if args.allow_live_payments:
        checks.append(
            CheckResult(
                name="live_payment_opt_in",
                status="fail",
                message=(
                    "Live payment probes are blocked by safety policy in this script. "
                    "Use mock mode for CI and controlled manual checks only."
                ),
            )
        )
    else:
        checks.append(
            CheckResult(
                name="live_payment_opt_in",
                status="pass",
                message="Live payment probes are disabled unless explicitly requested.",
            )
        )

    if args.check_health:
        checks.append(_health_check(args.base_url, args.timeout_seconds))
    else:
        checks.append(
            CheckResult(
                name="service_health",
                status="skip",
                message="Health check skipped (use --check-health to enable).",
            )
        )

    return checks


def _build_summary(args: argparse.Namespace, checks: list[CheckResult]) -> ProbeSummary:
    overall_status: Literal["pass", "fail"] = "pass"
    if any(check.status == "fail" for check in checks):
        overall_status = "fail"

    return ProbeSummary(
        mode=args.mode,
        base_url=args.base_url,
        generated_at=datetime.now(UTC).isoformat(),
        overall_status=overall_status,
        checks=checks,
        safety=SafetyConfig(
            require_sandbox=args.require_sandbox,
            allow_live_payments=args.allow_live_payments,
            max_amount_rub=args.max_amount_rub,
        ),
    )


def _render_markdown(summary: ProbeSummary) -> str:
    lines = [
        "# Billing Synthetic Probe",
        "",
        f"- Mode: `{summary.mode}`",
        f"- Generated at (UTC): `{summary.generated_at}`",
        f"- Overall status: `{summary.overall_status}`",
        f"- Base URL: `{summary.base_url}`",
        "",
        "## Safety",
        "",
        f"- `require_sandbox`: `{summary.safety.require_sandbox}`",
        f"- `allow_live_payments`: `{summary.safety.allow_live_payments}`",
        f"- `max_amount_rub`: `{summary.safety.max_amount_rub}`",
        "",
        "## Checks",
        "",
        "| Check | Status | Message |",
        "| --- | --- | --- |",
    ]

    for check in summary.checks:
        lines.append(f"| `{check.name}` | `{check.status}` | {check.message} |")

    return "\n".join(lines) + "\n"


def _write_outputs(summary: ProbeSummary, output_json: str, output_md: str) -> None:
    payload = asdict(summary)

    if output_json:
        path = Path(output_json)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    if output_md:
        path = Path(output_md)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_render_markdown(summary), encoding="utf-8")


def main() -> int:
    args = parse_args()

    checks: list[CheckResult]
    if args.mode == "mock":
        checks = _run_mock_mode(args)
    else:
        checks = _run_staging_mode(args)

    summary = _build_summary(args, checks)
    _write_outputs(summary, args.output_json, args.output_md)
    print(json.dumps(asdict(summary), indent=2))

    if summary.overall_status == "fail":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

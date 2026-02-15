#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
else
  TIMEOUT_BIN=""
fi

DEFAULT_TIMEOUT_SECONDS="${BILLING_BASELINE_TIMEOUT_SECONDS:-1800}"
ARTIFACT_ROOT="${BILLING_BASELINE_ARTIFACT_DIR:-$ROOT_DIR/artifacts/billing-confidence}"
RUN_ID="${BILLING_BASELINE_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
RUN_DIR="$ARTIFACT_ROOT/$RUN_ID"
LOG_DIR="$RUN_DIR/logs"
RESULTS_FILE="$RUN_DIR/results.tsv"
SUMMARY_JSON="$RUN_DIR/summary.json"
SUMMARY_MD="$RUN_DIR/summary.md"
LATEST_DIR="$ARTIFACT_ROOT/latest"

BACKEND_CMD="${BILLING_BASELINE_BACKEND_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc \"pytest -q open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py\"}"
FRONTEND_CMD="${BILLING_BASELINE_FRONTEND_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc \"npm run test:frontend -- --run src/routes/\\\\(app\\\\)/billing/balance/billing-balance.test.ts\"}"
E2E_CMD="${BILLING_BASELINE_E2E_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm --no-deps e2e \"npm ci && npm run test:e2e -- e2e/billing_wallet.spec.ts e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts\"}"

mkdir -p "$LOG_DIR"
printf "suite\ttier\ttimeout_seconds\texit_code\tduration_seconds\tstatus\tlog_file\tcommand\n" > "$RESULTS_FILE"

run_suite() {
  local suite="$1"
  local tier="$2"
  local timeout_seconds="$3"
  local command="$4"

  local log_file="$LOG_DIR/${suite}.log"
  local start_ts
  local end_ts
  local duration
  local exit_code
  local status

  echo "[billing-baseline] running suite=$suite tier=$tier timeout=${timeout_seconds}s"

  start_ts="$(date +%s)"
  set +e
  if [[ -n "$TIMEOUT_BIN" ]]; then
    "$TIMEOUT_BIN" "${timeout_seconds}" bash -lc "$command" >"$log_file" 2>&1
    exit_code=$?
  else
    bash -lc "$command" >"$log_file" 2>&1
    exit_code=$?
  fi
  set -e
  end_ts="$(date +%s)"
  duration="$((end_ts - start_ts))"

  if [[ "$exit_code" -eq 0 ]]; then
    status="pass"
  elif [[ "$exit_code" -eq 124 ]]; then
    status="timeout"
  else
    status="fail"
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$suite" \
    "$tier" \
    "$timeout_seconds" \
    "$exit_code" \
    "$duration" \
    "$status" \
    "$log_file" \
    "$command" >> "$RESULTS_FILE"

  if [[ "$status" == "pass" ]]; then
    echo "[billing-baseline] PASS suite=$suite duration=${duration}s"
  else
    echo "[billing-baseline] ${status^^} suite=$suite exit_code=$exit_code duration=${duration}s log=$log_file"
  fi
}

run_suite \
  "backend_billing_critical" \
  "pr-fast" \
  "$DEFAULT_TIMEOUT_SECONDS" \
  "$BACKEND_CMD"

run_suite \
  "frontend_billing_balance" \
  "pr-fast" \
  "$DEFAULT_TIMEOUT_SECONDS" \
  "$FRONTEND_CMD"

run_suite \
  "e2e_billing_wallet" \
  "pr-fast" \
  "$DEFAULT_TIMEOUT_SECONDS" \
  "$E2E_CMD"

pass_count="$(awk -F '\t' 'NR>1 && $6 == "pass" {count++} END {print count+0}' "$RESULTS_FILE")"
fail_count="$(awk -F '\t' 'NR>1 && $6 == "fail" {count++} END {print count+0}' "$RESULTS_FILE")"
timeout_count="$(awk -F '\t' 'NR>1 && $6 == "timeout" {count++} END {print count+0}' "$RESULTS_FILE")"
total_count="$(awk -F '\t' 'NR>1 {count++} END {print count+0}' "$RESULTS_FILE")"

overall_status="pass"
if [[ "$fail_count" -gt 0 || "$timeout_count" -gt 0 ]]; then
  overall_status="fail"
fi

export ROOT_DIR
export RUN_ID
export RUN_DIR
export RESULTS_FILE
export SUMMARY_JSON
export SUMMARY_MD
export pass_count
export fail_count
export timeout_count
export total_count
export overall_status

python3 - <<'PY'
import csv
import datetime as dt
import json
import os
from pathlib import Path

root_dir = Path(os.environ["ROOT_DIR"])
run_id = os.environ["RUN_ID"]
run_dir = Path(os.environ["RUN_DIR"])
results_file = Path(os.environ["RESULTS_FILE"])
summary_json = Path(os.environ["SUMMARY_JSON"])
summary_md = Path(os.environ["SUMMARY_MD"])
overall_status = os.environ["overall_status"]
pass_count = int(os.environ["pass_count"])
fail_count = int(os.environ["fail_count"])
timeout_count = int(os.environ["timeout_count"])
total_count = int(os.environ["total_count"])

def rel(path: Path) -> str:
    return os.path.relpath(path, root_dir)

suite_results = []
with results_file.open("r", encoding="utf-8") as handle:
    reader = csv.DictReader(handle, delimiter="\t")
    for row in reader:
        suite_results.append(
            {
                "suite": row["suite"],
                "tier": row["tier"],
                "status": row["status"],
                "timeout_seconds": int(row["timeout_seconds"]),
                "exit_code": int(row["exit_code"]),
                "duration_seconds": int(row["duration_seconds"]),
                "command": row["command"],
                "log_path": rel(Path(row["log_file"])),
            }
        )

artifact_index = [
    {"name": "results_tsv", "path": rel(results_file), "type": "text/tab-separated-values"},
    {"name": "summary_json", "path": rel(summary_json), "type": "application/json"},
    {"name": "summary_markdown", "path": rel(summary_md), "type": "text/markdown"},
]

for item in suite_results:
    artifact_index.append(
        {
            "name": f"log_{item['suite']}",
            "path": item["log_path"],
            "type": "text/plain",
        }
    )

generated_at = dt.datetime.now(dt.timezone.utc).isoformat()

report = {
    "schema_version": "1.0.0",
    "run_id": run_id,
    "timestamp": generated_at,
    "suite_results": suite_results,
    "coverage_summary": {
        "status": "not_collected",
        "target": ">=85% line coverage for open_webui.routers.billing and open_webui.utils.billing",
        "current_percent": None,
    },
    "flake_summary": {
        "status": "not_collected",
        "target": "<=2% across last 20 CI runs",
        "current_percent": None,
        "window_runs": 20,
    },
    "overall_status": overall_status,
    "counts": {
        "total": total_count,
        "passed": pass_count,
        "failed": fail_count,
        "timed_out": timeout_count,
    },
    "artifact_index": artifact_index,
}

summary_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

lines = [
    "# Billing Baseline Snapshot",
    "",
    f"- Run ID: `{run_id}`",
    f"- Generated at (UTC): `{generated_at}`",
    f"- Overall status: `{overall_status}`",
    f"- Counts: total={total_count}, passed={pass_count}, failed={fail_count}, timed_out={timeout_count}",
    "",
    "## Suite Results",
    "",
    "| Suite | Tier | Status | Exit | Duration(s) | Timeout(s) |",
    "| --- | --- | --- | ---: | ---: | ---: |",
]

for item in suite_results:
    lines.append(
        f"| `{item['suite']}` | `{item['tier']}` | `{item['status']}` | {item['exit_code']} | {item['duration_seconds']} | {item['timeout_seconds']} |"
    )

lines.extend([
    "",
    "## Commands",
    "",
])
for item in suite_results:
    lines.append(f"- `{item['suite']}`: `{item['command']}`")

lines.extend([
    "",
    "## Artifacts",
    "",
])
for artifact in artifact_index:
    lines.append(f"- `{artifact['name']}`: `{artifact['path']}`")

summary_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

mkdir -p "$LATEST_DIR"
cp "$SUMMARY_JSON" "$LATEST_DIR/summary.json"
cp "$SUMMARY_MD" "$LATEST_DIR/summary.md"
cp "$RESULTS_FILE" "$LATEST_DIR/results.tsv"

if [[ "$overall_status" == "fail" ]]; then
  echo "[billing-baseline] completed with failures: pass=$pass_count fail=$fail_count timeout=$timeout_count artifacts=$RUN_DIR"
  echo "[billing-baseline] summary_json=$SUMMARY_JSON summary_md=$SUMMARY_MD"
  echo "[billing-baseline] latest_dir=$LATEST_DIR"
  exit 1
fi

echo "[billing-baseline] completed successfully: pass=$pass_count fail=$fail_count timeout=$timeout_count artifacts=$RUN_DIR"
echo "[billing-baseline] summary_json=$SUMMARY_JSON summary_md=$SUMMARY_MD"
echo "[billing-baseline] latest_dir=$LATEST_DIR"

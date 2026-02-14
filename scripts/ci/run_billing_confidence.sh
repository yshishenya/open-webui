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

usage() {
  cat <<'EOF'
Usage: run_billing_confidence.sh [--tier <pr-fast|merge-medium|release-heavy>] [--dry-run]
                                 [--artifact-dir <path>] [--output-dir <path>]
                                 [--run-id <id>] [--timeout-seconds <int>]
EOF
}

TIER="${BILLING_CONFIDENCE_TIER:-pr-fast}"
DRY_RUN="false"
DEFAULT_TIMEOUT_SECONDS="${BILLING_CONFIDENCE_TIMEOUT_SECONDS:-1800}"
ARTIFACT_ROOT="${BILLING_CONFIDENCE_ARTIFACT_DIR:-$ROOT_DIR/artifacts/billing-confidence}"
RUN_ID="${BILLING_CONFIDENCE_RUN_ID:-}"
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)
      TIER="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --artifact-dir)
      ARTIFACT_ROOT="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --run-id)
      RUN_ID="${2:-}"
      shift 2
      ;;
    --timeout-seconds)
      DEFAULT_TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[billing-confidence] unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

if [[ "$ARTIFACT_ROOT" != /* ]]; then
  ARTIFACT_ROOT="$ROOT_DIR/$ARTIFACT_ROOT"
fi

if [[ -n "$OUTPUT_DIR" ]]; then
  if [[ "$OUTPUT_DIR" != /* ]]; then
    RUN_DIR="$ROOT_DIR/$OUTPUT_DIR"
  else
    RUN_DIR="$OUTPUT_DIR"
  fi
  RUN_ID="$(basename "$RUN_DIR")"
  ARTIFACT_ROOT="$(dirname "$RUN_DIR")"
elif [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-${TIER}"
  RUN_DIR="$ARTIFACT_ROOT/$RUN_ID"
else
  RUN_DIR="$ARTIFACT_ROOT/$RUN_ID"
fi
LOG_DIR="$RUN_DIR/logs"
JUNIT_DIR="$RUN_DIR/junit"
TRACE_DIR="$RUN_DIR/traces"
COVERAGE_DIR="$RUN_DIR/coverage"
RESULTS_FILE="$RUN_DIR/results.tsv"
SUMMARY_JSON="$RUN_DIR/summary.json"
SUMMARY_MD="$RUN_DIR/summary.md"
LATEST_DIR="$ARTIFACT_ROOT/latest"

mkdir -p "$LOG_DIR" "$JUNIT_DIR" "$TRACE_DIR" "$COVERAGE_DIR" "$LATEST_DIR"

RUN_DIR_CMD_PATH="$(python3 - <<'PY' "$ROOT_DIR" "$RUN_DIR"
import os
import sys

root = os.path.abspath(sys.argv[1])
run_dir = os.path.abspath(sys.argv[2])
rel = os.path.relpath(run_dir, root)
if rel.startswith(".."):
    print(run_dir)
else:
    print(rel)
PY
)"

BACKEND_CRITICAL_CMD="${BILLING_CONF_BACKEND_CRITICAL_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm airis bash -lc \"pytest -q --junitxml=__JUNIT_PATH__ open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py\"}"

BILLING_CONF_BACKEND_WEBUI_SECRET_KEY="${BILLING_CONF_BACKEND_WEBUI_SECRET_KEY:-ci-webui-secret-key}"
BILLING_CONF_BACKEND_WEBUI_AUTH="${BILLING_CONF_BACKEND_WEBUI_AUTH:-true}"
BACKEND_PIP_DEPENDENCIES="${BILLING_CONF_BACKEND_PIP_DEPENDENCIES:-aiosmtplib email-validator}"

BACKEND_ENV_FLAGS="-e WEBUI_AUTH=${BILLING_CONF_BACKEND_WEBUI_AUTH} -e WEBUI_SECRET_KEY=${BILLING_CONF_BACKEND_WEBUI_SECRET_KEY}"

BACKEND_CRITICAL_CMD="${BILLING_CONF_BACKEND_CRITICAL_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm ${BACKEND_ENV_FLAGS} airis bash -lc \"python -m pip install -q ${BACKEND_PIP_DEPENDENCIES} && pytest -q --junitxml=__JUNIT_PATH__ open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/utils/test_billing_integration.py\"}"

BACKEND_COVERAGE_CMD="${BILLING_CONF_BACKEND_COVERAGE_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm -e DATABASE_URL= ${BACKEND_ENV_FLAGS} airis bash -lc \"python -m pip install -q pytest-cov ${BACKEND_PIP_DEPENDENCIES} && cd /app/backend && pytest -q --maxfail=1 --disable-warnings --junitxml=__JUNIT_PATH__ --cov=open_webui.routers.billing --cov=open_webui.utils.billing --cov-branch --cov-report=term-missing:skip-covered --cov-report=json:__COVERAGE_JSON_PATH__ open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py open_webui/test/apps/webui/routers/test_billing_core_paths.py open_webui/test/apps/webui/routers/test_billing_router_expanded_paths.py open_webui/test/apps/webui/routers/test_billing_router_additional_paths.py open_webui/test/apps/webui/routers/test_billing_public_pricing.py open_webui/test/apps/webui/utils/test_billing_integration.py open_webui/test/apps/webui/utils/test_billing_quota.py open_webui/test/apps/webui/utils/test_billing_service_core.py open_webui/test/apps/webui/utils/test_billing_service_extended.py open_webui/test/apps/webui/utils/test_billing_service_webhook_statuses.py open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py open_webui/test/apps/webui/routers/test_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_images_billing.py open_webui/test/apps/webui/routers/test_openai_speech_billing.py open_webui/test/apps/webui/routers/test_audio_billing.py\" && python3 scripts/ci/check_billing_module_coverage.py --coverage-json __HOST_COVERAGE_JSON_PATH__ --routers-line-min ${BILLING_COVERAGE_MIN_ROUTERS_LINE:-85} --routers-branch-min ${BILLING_COVERAGE_MIN_ROUTERS_BRANCH:-65} --utils-line-min ${BILLING_COVERAGE_MIN_UTILS_LINE:-85} --utils-branch-min ${BILLING_COVERAGE_MIN_UTILS_BRANCH:-70}}"

BACKEND_FULL_PACK_CMD="${BILLING_CONF_BACKEND_FULL_PACK_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm ${BACKEND_ENV_FLAGS} airis bash -lc \"python -m pip install -q ${BACKEND_PIP_DEPENDENCIES} && pytest -q --junitxml=__JUNIT_PATH__ open_webui/test/apps/webui/routers/test_billing_topup.py open_webui/test/apps/webui/routers/test_billing_subscription.py open_webui/test/apps/webui/routers/test_billing_subscription_webhook.py open_webui/test/apps/webui/routers/test_billing_webhook_direct_path.py open_webui/test/apps/webui/routers/test_billing_core_paths.py open_webui/test/apps/webui/routers/test_billing_router_expanded_paths.py open_webui/test/apps/webui/routers/test_billing_router_additional_paths.py open_webui/test/apps/webui/routers/test_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_billing_public_pricing.py open_webui/test/apps/webui/routers/test_openai_chat_billing.py open_webui/test/apps/webui/routers/test_openai_chat_billing_streaming.py open_webui/test/apps/webui/routers/test_openai_chat_billing_lead_magnet.py open_webui/test/apps/webui/routers/test_images_billing.py open_webui/test/apps/webui/routers/test_audio_billing.py open_webui/test/apps/webui/routers/test_openai_speech_billing.py open_webui/test/apps/webui/routers/test_admin_billing_wallet_adjust.py open_webui/test/apps/webui/utils/test_billing_integration.py open_webui/test/apps/webui/utils/test_billing_quota.py open_webui/test/apps/webui/utils/test_billing_service_core.py open_webui/test/apps/webui/utils/test_billing_service_extended.py open_webui/test/apps/webui/utils/test_billing_service_webhook_statuses.py open_webui/test/apps/webui/utils/test_billing_seed.py open_webui/test/apps/webui/utils/test_wallet_service.py\"}"

FRONTEND_BALANCE_CMD="${BILLING_CONF_FRONTEND_BALANCE_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml run --rm --no-deps airis-frontend sh -lc \"if [ ! -e node_modules/.bin/vitest ]; then npm ci --legacy-peer-deps; fi; npm run test:frontend -- --run src/routes/\\\\(app\\\\)/billing/balance/billing-balance.test.ts\"}"

E2E_WALLET_CMD="${BILLING_CONF_E2E_WALLET_CMD:-docker compose -f docker-compose.yaml -f docker-compose.dev.yaml -f .codex/docker-compose.codex.yaml run --rm e2e \"npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 && PLAYWRIGHT_JUNIT_OUTPUT_FILE=__JUNIT_PATH__ npm run test:e2e -- --trace retain-on-failure --reporter=line,junit --output=__TRACE_DIR__ e2e/billing_wallet.spec.ts e2e/billing_wallet_recovery.spec.ts e2e/billing_lead_magnet.spec.ts\"}"

declare -a SUITE_NAMES=()
declare -a SUITE_TIMEOUTS=()
declare -a SUITE_JUNIT_RELS=()
declare -a SUITE_TRACE_RELS=()
declare -a SUITE_COMMANDS=()

add_suite() {
  local name="$1"
  local timeout_seconds="$2"
  local junit_rel="$3"
  local trace_rel="$4"
  local command="$5"
  SUITE_NAMES+=("$name")
  SUITE_TIMEOUTS+=("$timeout_seconds")
  SUITE_JUNIT_RELS+=("$junit_rel")
  SUITE_TRACE_RELS+=("$trace_rel")
  SUITE_COMMANDS+=("$command")
}

case "$TIER" in
  pr-fast)
    add_suite "backend_billing_critical" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_critical.xml" "" "$BACKEND_CRITICAL_CMD"
    add_suite "frontend_billing_balance" "$DEFAULT_TIMEOUT_SECONDS" "" "" "$FRONTEND_BALANCE_CMD"
    add_suite "e2e_billing_wallet" "$DEFAULT_TIMEOUT_SECONDS" "junit/e2e_billing_wallet.xml" "traces/e2e_billing_wallet" "$E2E_WALLET_CMD"
    ;;
  merge-medium)
    add_suite "backend_billing_critical" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_critical.xml" "" "$BACKEND_CRITICAL_CMD"
    add_suite "backend_billing_coverage" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_coverage.xml" "" "$BACKEND_COVERAGE_CMD"
    add_suite "frontend_billing_balance" "$DEFAULT_TIMEOUT_SECONDS" "" "" "$FRONTEND_BALANCE_CMD"
    add_suite "e2e_billing_wallet" "$DEFAULT_TIMEOUT_SECONDS" "junit/e2e_billing_wallet.xml" "traces/e2e_billing_wallet" "$E2E_WALLET_CMD"
    ;;
  release-heavy)
    add_suite "backend_billing_critical" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_critical.xml" "" "$BACKEND_CRITICAL_CMD"
    add_suite "backend_billing_coverage" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_coverage.xml" "" "$BACKEND_COVERAGE_CMD"
    add_suite "backend_billing_full_pack" "$DEFAULT_TIMEOUT_SECONDS" "junit/backend_billing_full_pack.xml" "" "$BACKEND_FULL_PACK_CMD"
    add_suite "frontend_billing_balance" "$DEFAULT_TIMEOUT_SECONDS" "" "" "$FRONTEND_BALANCE_CMD"
    add_suite "e2e_billing_wallet" "$DEFAULT_TIMEOUT_SECONDS" "junit/e2e_billing_wallet.xml" "traces/e2e_billing_wallet" "$E2E_WALLET_CMD"
    ;;
  *)
    echo "[billing-confidence] unsupported tier: $TIER"
    echo "[billing-confidence] expected one of: pr-fast, merge-medium, release-heavy"
    exit 2
    ;;
esac

printf "suite\ttier\ttimeout_seconds\texit_code\tduration_seconds\tstatus\tlog_path\tjunit_path\ttrace_path\tcoverage_path\tcommand\n" > "$RESULTS_FILE"

run_suite() {
  local index="$1"
  local suite="${SUITE_NAMES[$index]}"
  local timeout_seconds="${SUITE_TIMEOUTS[$index]}"
  local junit_rel="${SUITE_JUNIT_RELS[$index]}"
  local trace_rel="${SUITE_TRACE_RELS[$index]}"
  local command="${SUITE_COMMANDS[$index]}"

  local log_rel="logs/${suite}.log"
  local log_abs="$RUN_DIR/$log_rel"
  local junit_cmd_path=""
  local trace_cmd_path=""
  local coverage_rel=""
  local coverage_abs=""
  local coverage_cmd_path=""
  local host_coverage_cmd_path=""
  local backend_artifact_base=""
  local start_ts
  local end_ts
  local duration_seconds
  local exit_code
  local status

  if [[ -n "$junit_rel" ]]; then
    mkdir -p "$(dirname "$RUN_DIR/$junit_rel")"
    junit_cmd_path="$RUN_DIR_CMD_PATH/$junit_rel"
    command="${command//__JUNIT_PATH__/$junit_cmd_path}"
  fi

  if [[ -n "$trace_rel" ]]; then
    mkdir -p "$RUN_DIR/$trace_rel"
    trace_cmd_path="$RUN_DIR_CMD_PATH/$trace_rel"
    command="${command//__TRACE_DIR__/$trace_cmd_path}"
  fi

  if [[ "$command" == *"__COVERAGE_JSON_PATH__"* ]]; then
    coverage_rel="coverage/${suite}.json"
    coverage_abs="$RUN_DIR/$coverage_rel"
    mkdir -p "$(dirname "$coverage_abs")"
    coverage_cmd_path="$RUN_DIR_CMD_PATH/$coverage_rel"
    host_coverage_cmd_path="$coverage_cmd_path"
    if [[ "$suite" == backend_* ]]; then
      host_coverage_cmd_path="backend/$coverage_cmd_path"
      backend_artifact_base="$ROOT_DIR/backend/$RUN_DIR_CMD_PATH"
    fi
    command="${command//__COVERAGE_JSON_PATH__/$coverage_cmd_path}"
    command="${command//__HOST_COVERAGE_JSON_PATH__/$host_coverage_cmd_path}"
  fi

  if [[ -n "$junit_rel" && "$suite" == backend_* && -z "$backend_artifact_base" ]]; then
    backend_artifact_base="$ROOT_DIR/backend/$RUN_DIR_CMD_PATH"
  fi

  echo "[billing-confidence] running suite=$suite tier=$TIER timeout=${timeout_seconds}s dry_run=$DRY_RUN"
  start_ts="$(date +%s)"

  if [[ "$DRY_RUN" == "true" ]]; then
    printf "DRY_RUN=1\nCOMMAND=%s\n" "$command" > "$log_abs"
    exit_code=0
  else
    set +e
    if [[ -n "$TIMEOUT_BIN" ]]; then
      "$TIMEOUT_BIN" "$timeout_seconds" bash -lc "$command" >"$log_abs" 2>&1
      exit_code=$?
    else
      bash -lc "$command" >"$log_abs" 2>&1
      exit_code=$?
    fi
    set -e
  fi
  end_ts="$(date +%s)"
  duration_seconds="$((end_ts - start_ts))"

  # Backend service in docker-compose.dev mounts only ./backend. Normalize
  # backend-generated artifacts into the canonical run directory for triage.
  if [[ -n "$backend_artifact_base" ]]; then
    if [[ -n "$junit_rel" ]]; then
      junit_backend_abs="$backend_artifact_base/$junit_rel"
      if [[ ! -f "$RUN_DIR/$junit_rel" && -f "$junit_backend_abs" ]]; then
        mkdir -p "$(dirname "$RUN_DIR/$junit_rel")"
        cp "$junit_backend_abs" "$RUN_DIR/$junit_rel"
      fi
    fi

    if [[ -n "$coverage_rel" ]]; then
      coverage_backend_abs="$backend_artifact_base/$coverage_rel"
      if [[ ! -f "$coverage_abs" && -f "$coverage_backend_abs" ]]; then
        mkdir -p "$(dirname "$coverage_abs")"
        cp "$coverage_backend_abs" "$coverage_abs"
      fi
    fi
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    status="dry_run"
  elif [[ "$exit_code" -eq 0 ]]; then
    status="pass"
  elif [[ "$exit_code" -eq 124 ]]; then
    status="timeout"
  else
    status="fail"
  fi

  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$suite" \
    "$TIER" \
    "$timeout_seconds" \
    "$exit_code" \
    "$duration_seconds" \
    "$status" \
    "$log_rel" \
    "$junit_rel" \
    "$trace_rel" \
    "$coverage_rel" \
    "$command" >> "$RESULTS_FILE"

  echo "[billing-confidence] suite=$suite status=$status exit_code=$exit_code duration=${duration_seconds}s"
}

for idx in "${!SUITE_NAMES[@]}"; do
  run_suite "$idx"
done

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
export TIER

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
tier = os.environ["TIER"]
overall_status = os.environ["overall_status"]
pass_count = int(os.environ["pass_count"])
fail_count = int(os.environ["fail_count"])
timeout_count = int(os.environ["timeout_count"])
total_count = int(os.environ["total_count"])


def rel(path: Path) -> str:
    return os.path.relpath(path, root_dir)


suite_results = []
artifact_index = []

with results_file.open("r", encoding="utf-8") as handle:
    reader = csv.DictReader(handle, delimiter="\t")
    for row in reader:
        log_rel = row["log_path"]
        junit_rel = row["junit_path"] or None
        trace_rel = row["trace_path"] or None
        coverage_rel = row["coverage_path"] or None

        log_abs = run_dir / log_rel
        junit_abs = run_dir / junit_rel if junit_rel else None
        trace_abs = run_dir / trace_rel if trace_rel else None
        coverage_abs = run_dir / coverage_rel if coverage_rel else None

        suite_result = {
            "suite": row["suite"],
            "tier": row["tier"],
            "status": row["status"],
            "timeout_seconds": int(row["timeout_seconds"]),
            "exit_code": int(row["exit_code"]),
            "duration_seconds": int(row["duration_seconds"]),
            "command": row["command"],
            "artifacts": {
                "log": rel(log_abs),
                "junit": rel(junit_abs) if junit_abs else None,
                "trace": rel(trace_abs) if trace_abs else None,
                "coverage_json": rel(coverage_abs) if coverage_abs else None,
            },
        }
        suite_results.append(suite_result)

        artifact_index.append(
            {
                "name": f"log_{row['suite']}",
                "type": "text/plain",
                "path": rel(log_abs),
                "exists": log_abs.exists(),
            }
        )

        if junit_abs is not None:
            artifact_index.append(
                {
                    "name": f"junit_{row['suite']}",
                    "type": "application/xml",
                    "path": rel(junit_abs),
                    "exists": junit_abs.exists(),
                }
            )

        if trace_abs is not None:
            artifact_index.append(
                {
                    "name": f"trace_{row['suite']}",
                    "type": "directory",
                    "path": rel(trace_abs),
                    "exists": trace_abs.exists(),
                }
            )

        if coverage_abs is not None:
            artifact_index.append(
                {
                    "name": f"coverage_{row['suite']}",
                    "type": "application/json",
                    "path": rel(coverage_abs),
                    "exists": coverage_abs.exists(),
                }
            )

generated_at = dt.datetime.now(dt.timezone.utc).isoformat()

report = {
    "schema_version": "1.0.0",
    "run_id": run_id,
    "timestamp": generated_at,
    "tier": tier,
    "overall_status": overall_status,
    "counts": {
        "total": total_count,
        "passed": pass_count,
        "failed": fail_count,
        "timed_out": timeout_count,
    },
    "suite_results": suite_results,
    "artifact_index": artifact_index,
}

summary_json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

lines = [
    "# Billing Confidence Run",
    "",
    f"- Run ID: `{run_id}`",
    f"- Tier: `{tier}`",
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

lines.extend(["", "## Artifacts", ""])
for artifact in artifact_index:
    lines.append(
        f"- `{artifact['name']}`: `{artifact['path']}` (exists={artifact['exists']})"
    )

summary_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

cp "$SUMMARY_JSON" "$LATEST_DIR/summary.json"
cp "$SUMMARY_MD" "$LATEST_DIR/summary.md"
cp "$RESULTS_FILE" "$LATEST_DIR/results.tsv"
rm -rf "$LATEST_DIR/coverage"
if compgen -G "$COVERAGE_DIR/*.json" > /dev/null; then
  mkdir -p "$LATEST_DIR/coverage"
  cp "$COVERAGE_DIR"/*.json "$LATEST_DIR/coverage/"
fi

echo "[billing-confidence] tier=$TIER overall_status=$overall_status run_dir=$RUN_DIR"
echo "[billing-confidence] summary_json=$SUMMARY_JSON summary_md=$SUMMARY_MD"

if [[ "$overall_status" == "fail" ]]; then
  exit 1
fi

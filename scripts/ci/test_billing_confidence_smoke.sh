#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_SCRIPT="${ROOT_DIR}/scripts/ci/run_billing_confidence.sh"

OUTPUT_ROOT="${BILLING_CONFIDENCE_SMOKE_OUTPUT_DIR:-}"
KEEP_OUTPUT="false"
if [[ -n "$OUTPUT_ROOT" ]]; then
  if [[ "$OUTPUT_ROOT" != /* ]]; then
    OUTPUT_ROOT="$ROOT_DIR/$OUTPUT_ROOT"
  fi
  mkdir -p "$OUTPUT_ROOT"
  KEEP_OUTPUT="true"
else
  OUTPUT_ROOT="$(mktemp -d)"
fi

if [[ "$KEEP_OUTPUT" != "true" ]]; then
  trap 'rm -rf "$OUTPUT_ROOT"' EXIT
else
  echo "[billing-confidence-smoke] output_root=$OUTPUT_ROOT"
fi

assert() {
  local condition="$1"
  local message="$2"
  if ! eval "$condition"; then
    echo "[billing-confidence-smoke] ASSERTION FAILED: $message" >&2
    exit 1
  fi
}

PASS_E2E_CMD='printf "smoke trace" > __TRACE_DIR__/smoke-trace.txt && printf "ok" > __JUNIT_PATH__'

run_case() {
  local tier="$1"
  local run_id="$2"
  local expect_overall_pass="$3"
  local expect_failed_suite="$4"
  local e2e_command="$5"
  local analytics_command="${6:-$PASS_E2E_CMD}"
  local billing_ui_command="${7:-$PASS_E2E_CMD}"
  local setup_command="${8:-true}"

  echo "[billing-confidence-smoke] running tier=$tier run_id=$run_id"
  local run_dir="$OUTPUT_ROOT/$run_id"
  mkdir -p "$run_dir"
  local run_log="$run_dir/harness.log"
  echo "[billing-confidence-smoke] run_dir=$run_dir"
  echo "[billing-confidence-smoke] run_log=$run_log"
  set +e
  (
    export BILLING_CONFIDENCE_ARTIFACT_DIR="$OUTPUT_ROOT"
    export BILLING_CONF_BACKEND_CRITICAL_CMD='bash -lc "printf \"ok\" > __JUNIT_PATH__"'
    export BILLING_CONF_BACKEND_COVERAGE_CMD='bash -lc "printf \"{}\" > __COVERAGE_JSON_PATH__; printf \"ok\" > __JUNIT_PATH__"'
    export BILLING_CONF_BACKEND_FULL_PACK_CMD='bash -lc "printf \"ok\" > __JUNIT_PATH__"'
    export BILLING_CONF_FRONTEND_BALANCE_CMD='bash -lc "echo ok"'
    export BILLING_CONF_E2E_WALLET_CMD="$e2e_command"
    # Override every Docker command, including the fresh-app setup.
    export BILLING_CONF_E2E_BILLING_UI_SETUP_CMD="$setup_command"
    export BILLING_CONF_E2E_ANALYTICS_CMD="$analytics_command"
    export BILLING_CONF_E2E_BILLING_UI_CMD="$billing_ui_command"
    "$RUN_SCRIPT" --tier "$tier" --run-id "$run_id"
  ) >"$run_log" 2>&1
  local run_status=$?
  set -e
  echo "[billing-confidence-smoke] command_exit=$run_status (run log: $run_log)"

  if [[ "$expect_overall_pass" == "true" ]]; then
    assert "[[ $run_status -eq 0 ]]" "run should pass for tier=$tier run_id=$run_id (log: $run_log)"
  else
    assert "[[ $run_status -ne 0 ]]" "run should fail for tier=$tier run_id=$run_id (log: $run_log)"
  fi

  local results_file="$run_dir/results.tsv"
  assert "[[ -f '$results_file' ]]" "results file must exist: $results_file"
  assert "[[ -f \"$run_dir/summary.json\" ]]" "summary file must exist"
  assert "[[ -f \"$run_dir/summary.md\" ]]" "summary markdown must exist"

  python3 - "$results_file" "$expect_failed_suite" <<'PY'
import csv
import json
import pathlib
import sys

results_file = pathlib.Path(sys.argv[1])
expected_failed_suite = sys.argv[2]

rows = list(csv.reader(results_file.open(newline=""), delimiter="\t"))
if len(rows) < 2:
    raise SystemExit(f"results.tsv has no suite rows: {results_file}")
header = rows[0]
expected_columns = 11
if len(header) != expected_columns:
    raise SystemExit(f"unexpected columns in results header: {header}")

data = rows[1:]
suite_names = [row[0] for row in data]
if len(set(suite_names)) != len(suite_names):
    raise SystemExit(f"duplicate suite entries found: {suite_names}")

if suite_names[-3:] != ["e2e_billing_wallet", "e2e_billing_analytics_ui", "e2e_billing_ui"]:
    raise SystemExit(f"wallet, analytics and billing UI must run in order: {suite_names}")

summary = json.loads((results_file.parent / "summary.json").read_text())
expected_overall = "fail" if expected_failed_suite else "pass"
if summary["overall_status"] != expected_overall:
    raise SystemExit(f"unexpected summary status: {summary['overall_status']}")
if [item["suite"] for item in summary["suite_results"]] != suite_names:
    raise SystemExit("summary must include all required suites in execution order")

for row in data:
    if len(row) != expected_columns:
        raise SystemExit(f"unexpected row format: {row}")

    suite, status = row[0], row[5]
    if "docker compose" in row[10]:
        raise SystemExit(f"suite override must replace all Docker setup and test commands: {suite}")
    junit_rel = row[7]
    trace_rel = row[8]
    coverage_rel = row[9]
    junit_abs = results_file.parent / junit_rel if junit_rel else None
    trace_abs = results_file.parent / trace_rel if trace_rel else None
    coverage_abs = results_file.parent / coverage_rel if coverage_rel else None

    if suite.startswith("e2e_"):
        if junit_rel != f"junit/{suite}.xml" or trace_rel != f"traces/{suite}":
            raise SystemExit(f"E2E suite must have separate JUnit and traces: {row}")
        if status == "pass" and not (trace_abs / "smoke-trace.txt").is_file():
            raise SystemExit(f"trace placeholder did not reach suite command: {suite}")

    if status == "pass" and junit_rel and not junit_abs.is_file():
        raise SystemExit(
            f"pass suite missing required junit artifact: suite={suite} path={junit_abs}"
        )

    if status == "pass" and trace_rel and not trace_abs.is_dir():
        raise SystemExit(
            f"pass suite missing required trace directory: suite={suite} path={trace_abs}"
        )

    if status == "pass" and coverage_rel and not coverage_abs.is_file():
        raise SystemExit(
            f"pass suite missing required coverage artifact: suite={suite} path={coverage_abs}"
        )

if expected_failed_suite:
    for row in data:
        if row[0] == expected_failed_suite:
            if row[5] != "fail":
                raise SystemExit(
                    f"expected suite {expected_failed_suite} to fail; got {row[5]}"
                )
            break
    else:
        raise SystemExit(f"expected failed suite not found: {expected_failed_suite}")
    passing = [row for row in data if row[0] != expected_failed_suite and row[5] != "pass"]
    if passing:
        raise SystemExit(f"unexpected failed suite(s): {passing}")
else:
    non_pass = [row[0] for row in data if row[5] != "pass"]
    if non_pass:
        raise SystemExit(f"expected all suites to pass, got failures: {non_pass}")
PY
  local validate_status=$?
  if [[ $validate_status -ne 0 ]]; then
    echo "[billing-confidence-smoke] ASSERTION FAILED: result validation failed for run_id=$run_id" >&2
    echo "--- run log tail ---" >&2
    tail -n 40 "$run_log" >&2 || true
    cat "$results_file" >&2 || true
    exit 1
  fi
}

# Inspect real default commands without executing them. In particular, the CI
# wallet worker override must not override the UI configs' single-worker setup.
PLAN_DIR="$OUTPUT_ROOT/smoke-default-plan"
BILLING_CONF_E2E_WORKERS=2 "$RUN_SCRIPT" --tier pr-fast --dry-run --artifact-dir "$OUTPUT_ROOT" --run-id smoke-default-plan > "$OUTPUT_ROOT/plan.log" 2>&1
python3 - "$PLAN_DIR/results.tsv" "$ROOT_DIR/.codex/docker-compose.billing-ui.yaml" <<'PY'
import csv
import sys
from pathlib import Path

overlay = Path(sys.argv[2]).read_text().split("  e2e:\n", 1)[1]
assert "    network_mode: service:airis-e2e\n" in overlay, overlay
for variable in ["PLAYWRIGHT_BASE_URL", "ANALYTICS_TEST_API_URL"]:
    assert f"      {variable}: http://localhost:8080\n" in overlay, (variable, overlay)
assert "http://airis-e2e:" not in overlay, overlay

with open(sys.argv[1], newline="") as handle:
    suites = {row["suite"]: row["command"] for row in csv.DictReader(handle, delimiter="\t")}
analytics = suites["e2e_billing_analytics_ui"]
billing = suites["e2e_billing_ui"]
wallet_setup, wallet_run = suites["e2e_billing_wallet"].split(" && ", 1)
for flag in [".codex/docker-compose.billing-ui.yaml", "up -d --no-deps --force-recreate --wait --wait-timeout 240 airis-e2e"]:
    assert flag in wallet_setup, (flag, wallet_setup)
assert "--no-build" not in wallet_setup and "--build" not in wallet_setup, wallet_setup
assert "run --rm --no-deps e2e" in wallet_run and "--workers=2" in wallet_run, wallet_run
assert "--workers" not in wallet_setup, wallet_setup
assert "condition: service_healthy" in overlay, overlay
setup, analytics_run = analytics.split(" && ", 1)
for flag in [".codex/docker-compose.billing-ui.yaml", "up -d", "--no-deps", "--force-recreate", "--no-build", "--wait", "--wait-timeout 240 airis-e2e"]:
    assert flag in setup, (flag, setup)
for command, script in [(analytics_run, "test:e2e:analytics"), (billing, "test:e2e:billing-ui")]:
    for flag in [".codex/docker-compose.billing-ui.yaml", "run --rm --no-deps e2e", f"npm run {script} --", "PLAYWRIGHT_JUNIT_OUTPUT_FILE=", "--trace retain-on-failure", "--reporter=line,junit", "--output="]:
        assert flag in command, (flag, command)
    assert "--workers" not in command, command
    assert "__JUNIT_PATH__" not in command and "__TRACE_DIR__" not in command, command
PY

run_case "pr-fast" "smoke-pr-fast" "true" "" "$PASS_E2E_CMD"
run_case "merge-medium" "smoke-merge-medium" "true" "" "$PASS_E2E_CMD"
run_case "release-heavy" "smoke-release-heavy" "true" "" "$PASS_E2E_CMD"
run_case "release-heavy" "smoke-release-heavy-fail" "false" "e2e_billing_wallet" 'bash -lc "echo only-fail-case"'
run_case "pr-fast" "smoke-analytics-fail" "false" "e2e_billing_analytics_ui" "$PASS_E2E_CMD" "$PASS_E2E_CMD && exit 1"
run_case "merge-medium" "smoke-billing-ui-fail" "false" "e2e_billing_ui" "$PASS_E2E_CMD" "$PASS_E2E_CMD" "$PASS_E2E_CMD && exit 1"
run_case "pr-fast" "smoke-analytics-missing-junit" "false" "e2e_billing_analytics_ui" "$PASS_E2E_CMD" 'true'
run_case "release-heavy" "smoke-billing-ui-missing-junit" "false" "e2e_billing_ui" "$PASS_E2E_CMD" "$PASS_E2E_CMD" 'true'
run_case "pr-fast" "smoke-ui-setup-fail" "false" "e2e_billing_analytics_ui" "$PASS_E2E_CMD" "$PASS_E2E_CMD" "$PASS_E2E_CMD" 'false'
assert "[[ ! -f '$OUTPUT_ROOT/smoke-ui-setup-fail/junit/e2e_billing_analytics_ui.xml' ]]" "failed setup must not start analytics"

echo "[billing-confidence-smoke] all smoke checks passed"

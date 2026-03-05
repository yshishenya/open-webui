#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy_target.sh --target <name> [deploy_prod.sh args]
  scripts/deploy_target.sh --list-targets

Description:
  Wrapper around scripts/deploy_prod.sh that selects target-specific deploy config
  from local files:
    .env.deploy.<target>
    .env.deploy.<target>.local  (optional overrides)

  Example targets are stored in:
    deploy/targets/<target>.env.example

Examples:
  scripts/deploy_target.sh --target demo --yes --non-interactive --dry-run --skip-precheck
  scripts/deploy_target.sh --target prod --unique-tag

Notes:
  - Real target config files are local-only (gitignored via .env.* rule).
  - This script keeps deploy_prod.sh as the deployment engine.
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_ENGINE="${PROJECT_ROOT}/scripts/deploy_prod.sh"
TARGET_CONFIG_DIR="${PROJECT_ROOT}/deploy/targets"

list_targets() {
  local -a discovered
  local f

  discovered=()

  if [[ -d "${TARGET_CONFIG_DIR}" ]]; then
    shopt -s nullglob
    for f in "${TARGET_CONFIG_DIR}"/*.env.example; do
      discovered+=("$(basename "${f}" .env.example)")
    done
    shopt -u nullglob
  fi

  shopt -s nullglob
  for f in "${PROJECT_ROOT}"/.env.deploy.*; do
    local name
    name="$(basename "${f}")"
    name="${name#.env.deploy.}"

    if [[ "${name}" == "" || "${name}" == "*" || "${name}" == *.local || "${name}" == *.bak* ]]; then
      continue
    fi

    discovered+=("${name}")
  done
  shopt -u nullglob

  if [[ ${#discovered[@]} -eq 0 ]]; then
    echo "No targets found. Add deploy/targets/<name>.env.example and local .env.deploy.<name>."
    return 0
  fi

  printf '%s\n' "${discovered[@]}" | sort -u
}

TARGET="${DEPLOY_TARGET:-}"
declare -a FORWARD_ARGS
FORWARD_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      if [[ $# -lt 2 ]]; then
        echo "--target requires a value" >&2
        exit 2
      fi
      TARGET="$2"
      shift 2
      ;;
    --target=*)
      TARGET="${1#*=}"
      shift
      ;;
    --list-targets)
      list_targets
      exit 0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      FORWARD_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "${TARGET}" ]]; then
  echo "Missing --target. Use --list-targets to see available targets." >&2
  exit 2
fi

TARGET_ENV_FILE="${PROJECT_ROOT}/.env.deploy.${TARGET}"
TARGET_OVERRIDE_FILE="${PROJECT_ROOT}/.env.deploy.${TARGET}.local"
TARGET_EXAMPLE_FILE="${TARGET_CONFIG_DIR}/${TARGET}.env.example"

if [[ ! -f "${TARGET_ENV_FILE}" ]]; then
  echo "Missing target config: ${TARGET_ENV_FILE}" >&2
  if [[ -f "${TARGET_EXAMPLE_FILE}" ]]; then
    echo "Create it from example:" >&2
    echo "  cp ${TARGET_EXAMPLE_FILE} ${TARGET_ENV_FILE}" >&2
  else
    echo "No example template found for target '${TARGET}' in ${TARGET_CONFIG_DIR}" >&2
  fi
  exit 2
fi

if [[ ! -x "${DEPLOY_ENGINE}" ]]; then
  echo "Deploy engine not found or not executable: ${DEPLOY_ENGINE}" >&2
  exit 2
fi

TMP_DEPLOY_ENV="$(mktemp)"
cleanup() {
  rm -f "${TMP_DEPLOY_ENV}"
}
trap cleanup EXIT

cat "${TARGET_ENV_FILE}" > "${TMP_DEPLOY_ENV}"
if [[ -f "${TARGET_OVERRIDE_FILE}" ]]; then
  {
    echo ""
    echo "# --- local overrides from ${TARGET_OVERRIDE_FILE} ---"
    cat "${TARGET_OVERRIDE_FILE}"
  } >> "${TMP_DEPLOY_ENV}"
fi

echo "Deploy target: ${TARGET}"
echo "Target config: ${TARGET_ENV_FILE}"
if [[ -f "${TARGET_OVERRIDE_FILE}" ]]; then
  echo "Target overrides: ${TARGET_OVERRIDE_FILE}"
fi

echo ""
DEPLOY_ENV_FILE="${TMP_DEPLOY_ENV}" "${DEPLOY_ENGINE}" "${FORWARD_ARGS[@]}"

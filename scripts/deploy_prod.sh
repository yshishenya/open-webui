#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/deploy_prod.sh [<tag>] [options]

Builds and pushes the image on the dev host, then triggers the prod host to pull and restart.

Options:
  --interactive         Force interactive dialog (requires TTY).
  --non-interactive     Disable interactive dialog (always run with defaults/flags).
  --tag <tag>           Override the image tag.
  --unique-tag          Append a UTC timestamp suffix to the computed tag.
  --no-cache            Build without Docker layer cache.
  --pull                Always attempt to pull newer base layers during build.
  --force-recreate      Force container recreation on prod (even if config is unchanged).
  --dry-run             Print commands, do not execute them.
  -h, --help            Show this help.

Tagging behavior (default when no tag is provided):
  - Clean working tree:    <short-sha>
  - Dirty working tree:    <short-sha>-dirty-<hash>

Environment (can be set in .env.deploy):
  - PROD_HOST (default: airis-prod)
  - PROD_PATH (default: /opt/projects/open-webui)
  - PROD_SSH_PORT (optional)
  - PROD_GIT_PULL (default: 1)
  - POST_DEPLOY_STATUS (default: 1)
  - IMAGE_REPO (default: yshishenya/yshishenya)
  - DEPLOY_ENV_FILE (default: .env.deploy)
EOF
}

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"
if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  set -a
  . "${DEPLOY_ENV_FILE}"
  set +a
fi

IMAGE_REPO="${IMAGE_REPO:-yshishenya/yshishenya}"
PROD_HOST="${PROD_HOST:-airis-prod}"
PROD_PATH="${PROD_PATH:-/opt/projects/open-webui}"
PROD_SSH_PORT="${PROD_SSH_PORT:-}"
PROD_GIT_PULL="${PROD_GIT_PULL:-1}"
POST_DEPLOY_STATUS="${POST_DEPLOY_STATUS:-1}"
COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.prod.yml"

TAG=""
UNIQUE_TAG=0
NO_CACHE=0
PULL_BASE=0
FORCE_RECREATE=0
DRY_RUN=0
INTERACTIVE=0
NON_INTERACTIVE=0

if [[ $# -gt 0 && "${1:0:1}" != "-" ]]; then
  TAG="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interactive)
      INTERACTIVE=1
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE=1
      shift
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --unique-tag)
      UNIQUE_TAG=1
      shift
      ;;
    --no-cache)
      NO_CACHE=1
      shift
      ;;
    --pull)
      PULL_BASE=1
      shift
      ;;
    --force-recreate)
      FORCE_RECREATE=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

is_tty() {
  [[ -t 0 && -t 1 ]]
}

prompt_yes_no() {
  local prompt default ans
  prompt="$1"
  default="$2" # y|n

  while true; do
    if [[ "${default}" == "y" ]]; then
      read -r -p "${prompt} [Y/n] " ans || return 1
      ans="${ans:-y}"
    else
      read -r -p "${prompt} [y/N] " ans || return 1
      ans="${ans:-n}"
    fi
    case "${ans}" in
      y|Y|yes|YES) echo "y"; return 0 ;;
      n|N|no|NO) echo "n"; return 0 ;;
    esac
    echo "Please answer y or n." >&2
  done
}

prompt_choice() {
  local prompt default choices ans
  prompt="$1"
  default="$2"
  choices="$3"
  while true; do
    read -r -p "${prompt} (${choices}) [${default}] " ans || return 1
    ans="${ans:-${default}}"
    echo "${ans}"
    return 0
  done
}

compute_default_tag() {
  local sha dirty_tag diff_hash ts
  sha="$(git rev-parse --short HEAD)"
  dirty_tag=""

  if ! git diff --quiet --no-ext-diff >/dev/null 2>&1 || ! git diff --quiet --cached --no-ext-diff >/dev/null 2>&1; then
    diff_hash="$(
      {
        git diff --no-ext-diff
        git diff --cached --no-ext-diff
        git status --porcelain
      } | python3 -c 'import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest()[:8])'
    )"
    dirty_tag="-dirty-${diff_hash}"
  fi

  ts=""
  if [[ "${UNIQUE_TAG}" == "1" ]]; then
    ts="-$(date -u +%Y%m%d%H%M%S)"
  fi

  echo "${sha}${dirty_tag}${ts}"
}

interactive_dialog() {
  local computed custom choice yn

  echo ""
  echo "Deploy config (from ${DEPLOY_ENV_FILE}, with defaults):"
  echo "  PROD_HOST=${PROD_HOST}"
  echo "  PROD_PATH=${PROD_PATH}"
  echo "  IMAGE_REPO=${IMAGE_REPO}"
  echo ""

  computed="$(compute_default_tag)"
  echo "Default computed tag: ${computed}"

  choice="$(prompt_choice "Tag" "default" "default|unique|custom")" || exit 1
  case "${choice}" in
    default)
      UNIQUE_TAG=0
      TAG=""
      ;;
    unique)
      UNIQUE_TAG=1
      TAG=""
      ;;
    custom)
      read -r -p "Enter tag: " custom || exit 1
      if [[ -z "${custom}" ]]; then
        echo "Tag cannot be empty." >&2
        exit 2
      fi
      TAG="${custom}"
      ;;
    *)
      echo "Invalid tag choice: ${choice}" >&2
      exit 2
      ;;
  esac

  choice="$(prompt_choice "Build mode" "cache" "cache|no-cache|no-cache+pull|cache+pull")" || exit 1
  case "${choice}" in
    cache)
      NO_CACHE=0
      PULL_BASE=0
      ;;
    no-cache)
      NO_CACHE=1
      PULL_BASE=0
      ;;
    no-cache+pull)
      NO_CACHE=1
      PULL_BASE=1
      ;;
    cache+pull)
      NO_CACHE=0
      PULL_BASE=1
      ;;
    *)
      echo "Invalid build mode: ${choice}" >&2
      exit 2
      ;;
  esac

  yn="$(prompt_yes_no "Force recreate container on prod?" "n")" || exit 1
  FORCE_RECREATE=0
  if [[ "${yn}" == "y" ]]; then
    FORCE_RECREATE=1
  fi

  yn="$(prompt_yes_no "Dry-run (print commands only)?" "n")" || exit 1
  DRY_RUN=0
  if [[ "${yn}" == "y" ]]; then
    DRY_RUN=1
  fi

  # If we didn't pick a custom tag, compute it now with the chosen UNIQUE_TAG.
  if [[ -z "${TAG}" ]]; then
    TAG="$(compute_default_tag)"
  fi

  echo ""
  echo "Plan:"
  echo "  Build: docker build $( [[ ${PULL_BASE} == 1 ]] && printf '%s ' '--pull' )$( [[ ${NO_CACHE} == 1 ]] && printf '%s ' '--no-cache' )-t ${IMAGE_REPO}:${TAG} ."
  echo "  Push:  docker push ${IMAGE_REPO}:${TAG}"
  echo "  Prod:  docker compose pull && up -d --no-build$( [[ ${FORCE_RECREATE} == 1 ]] && printf '%s' ' --force-recreate' )"
  echo ""

  yn="$(prompt_yes_no "Proceed?" "n")" || exit 1
  if [[ "${yn}" != "y" ]]; then
    echo "Cancelled."
    exit 1
  fi
}

should_prompt=0
if [[ "${NON_INTERACTIVE}" == "1" ]]; then
  should_prompt=0
elif [[ "${INTERACTIVE}" == "1" ]]; then
  should_prompt=1
elif [[ -z "${TAG}" && "${UNIQUE_TAG}" == "0" && "${NO_CACHE}" == "0" && "${PULL_BASE}" == "0" && "${FORCE_RECREATE}" == "0" && "${DRY_RUN}" == "0" ]]; then
  # No args were provided other than env defaults: prefer interactive when run by a human in a terminal.
  should_prompt=1
fi

if [[ "${should_prompt}" == "1" ]]; then
  if ! is_tty; then
    echo "Interactive mode requires a TTY. Use --non-interactive or pass explicit flags." >&2
    exit 2
  fi
  interactive_dialog
fi

if [[ -z "${TAG}" ]]; then
  TAG="$(compute_default_tag)"
fi

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '+ '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

q() {
  printf '%q' "$1"
}

echo "Building ${IMAGE_REPO}:${TAG}..."
BUILD_ARGS=()
if [[ "${PULL_BASE}" == "1" ]]; then
  BUILD_ARGS+=(--pull)
fi
if [[ "${NO_CACHE}" == "1" ]]; then
  BUILD_ARGS+=(--no-cache)
fi
run docker build "${BUILD_ARGS[@]}" -t "${IMAGE_REPO}:${TAG}" .

echo "Pushing ${IMAGE_REPO}:${TAG}..."
run docker push "${IMAGE_REPO}:${TAG}"

SSH_PORT_ARGS=()
if [[ -n "${PROD_SSH_PORT}" ]]; then
  SSH_PORT_ARGS=(-p "${PROD_SSH_PORT}")
fi

echo "Deploying to ${PROD_HOST}..."
REMOTE_CMD="cd $(q "${PROD_PATH}") && "
if [[ "${PROD_GIT_PULL}" == "1" ]]; then
  REMOTE_CMD+="git pull --ff-only && "
fi
REMOTE_CMD+="WEBUI_IMAGE=$(q "${IMAGE_REPO}") WEBUI_DOCKER_TAG=$(q "${TAG}") docker compose ${COMPOSE_FILES} pull && "
REMOTE_CMD+="WEBUI_IMAGE=$(q "${IMAGE_REPO}") WEBUI_DOCKER_TAG=$(q "${TAG}") docker compose ${COMPOSE_FILES} up -d --remove-orphans --no-build"
if [[ "${FORCE_RECREATE}" == "1" ]]; then
  REMOTE_CMD+=" --force-recreate"
fi
if [[ "${POST_DEPLOY_STATUS}" == "1" ]]; then
  REMOTE_CMD+=" && WEBUI_IMAGE=$(q "${IMAGE_REPO}") WEBUI_DOCKER_TAG=$(q "${TAG}") docker compose ${COMPOSE_FILES} ps"
fi

run ssh "${SSH_PORT_ARGS[@]}" "${PROD_HOST}" "bash -lc $(q "${REMOTE_CMD}")"

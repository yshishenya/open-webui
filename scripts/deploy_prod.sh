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
  -y, --yes            Skip confirmation prompts and run with selected/default options.
  --skip-precheck       Skip SSH connectivity precheck (use only if SSH is already verified).
  -h, --help            Show this help.

Tagging behavior (default when no tag is provided):
  - Clean working tree:    <short-sha>
  - Dirty working tree:    <short-sha>-dirty-<hash>

Environment (can be set in .env.deploy):
  - PROD_HOST (default: airis-prod)
  - PROD_PATH (default: /opt/projects/open-webui)
  - PROD_SSH_PORT (optional)
  - PROD_SSH_KEY (optional, full path to private key)
  - PROD_GIT_PULL (default: 1)
  - POST_DEPLOY_STATUS (default: 1)
  - IMAGE_REPO (default: yshishenya/yshishenya)
  - DEPLOY_ENV_FILE (default: .env.deploy)
EOF
}

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"
resolve_python_cmd() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return 0
  fi

  if command -v python >/dev/null 2>&1; then
    echo "python"
    return 0
  fi

  return 1
}

PYTHON_CMD="$(resolve_python_cmd || true)"
if [[ -z "${PYTHON_CMD}" ]]; then
  echo "Required command not found: python3 (or python)" >&2
  exit 1
fi

load_deploy_env() {
  local key
  local value

  if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
    return 0
  fi

  while IFS= read -r -d '' key && IFS= read -r -d '' value; do
    export "${key}=${value}"
  done < <(
    "${PYTHON_CMD}" - "${DEPLOY_ENV_FILE}" <<'PY'
import re
import shlex
import sys

path = sys.argv[1]
assignment_re = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")

with open(path, "r", encoding="utf-8") as env_file:
    for line_no, raw_line in enumerate(env_file, start=1):
        stripped_line = raw_line.strip()
        if not stripped_line or stripped_line.startswith("#"):
            continue

        match = assignment_re.match(raw_line.rstrip("\n"))
        if match is None:
            print(
                f"Ignoring invalid line in {path}:{line_no}: {raw_line.rstrip()}",
                file=sys.stderr,
            )
            continue

        key = match.group(1)
        value_source = match.group(2)

        lexer = shlex.shlex(value_source, posix=True)
        lexer.whitespace_split = True
        lexer.commenters = "#"

        try:
            tokens = list(lexer)
        except ValueError as exc:
            print(
                f"Ignoring invalid value in {path}:{line_no}: {exc}",
                file=sys.stderr,
            )
            continue

        if not tokens:
            value = ""
        elif len(tokens) == 1:
            value = tokens[0]
        else:
            print(
                f"Ignoring invalid value in {path}:{line_no}: {raw_line.rstrip()}",
                file=sys.stderr,
            )
            continue

        sys.stdout.write(f"{key}\0{value}\0")
PY
  )
}

load_deploy_env

IMAGE_REPO="${IMAGE_REPO:-yshishenya/yshishenya}"
PROD_HOST="${PROD_HOST:-airis-prod}"
PROD_PATH="${PROD_PATH:-/opt/projects/open-webui}"
PROD_SSH_PORT="${PROD_SSH_PORT:-}"
PROD_SSH_KEY="${PROD_SSH_KEY:-}"
SSH_KEY_HINT="${PROD_SSH_KEY:-${HOME}/.ssh/airis_prod}"
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
AUTO_APPROVE=0
SKIP_SSH_PRECHECK=0

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
    -y|--yes)
      AUTO_APPROVE=1
      shift
      ;;
    --skip-precheck)
      SKIP_SSH_PRECHECK=1
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

require_command() {
  local name="$1"
  if ! command -v "${name}" >/dev/null 2>&1; then
    echo "Required command not found: ${name}" >&2
    exit 1
  fi
}

show_runtime_settings() {
  echo ""
  echo "Resolved deploy settings:"
  echo "  IMAGE_REPO=${IMAGE_REPO}"
  echo "  PROD_HOST=${PROD_HOST}"
  echo "  PROD_PATH=${PROD_PATH}"
  echo "  PROD_SSH_PORT=${PROD_SSH_PORT:-<default:22>}"
  echo "  PROD_GIT_PULL=${PROD_GIT_PULL}"
  echo "  POST_DEPLOY_STATUS=${POST_DEPLOY_STATUS}"
  echo "  FORCE_RECREATE=${FORCE_RECREATE}"
  echo "  NO_CACHE=${NO_CACHE}"
  echo "  PULL_BASE=${PULL_BASE}"
  echo "  UNIQUE_TAG=${UNIQUE_TAG}"
  echo "  DRY_RUN=${DRY_RUN}"
  echo "  TAG=${TAG}"
  echo ""
}

if [[ "${AUTO_APPROVE}" == "1" ]]; then
  NON_INTERACTIVE=1
fi

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
      } | "${PYTHON_CMD}" -c 'import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest()[:8])'
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

require_command docker
require_command git

if [[ -z "${TAG}" ]]; then
  TAG="$(compute_default_tag)"
fi

show_runtime_settings

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '+ '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

normalize_ssh_key_path() {
  local key_path="$1"
  if [[ "${key_path}" == "~/"* ]]; then
    echo "${HOME}${key_path#"~"}"
    return 0
  fi
  echo "${key_path}"
}

derive_ssh_public_key_path() {
  local key_path="$1"
  if [[ "${key_path}" == *.pub ]]; then
    echo "${key_path}"
    return 0
  fi

  echo "${key_path}.pub"
}

if [[ -n "${PROD_SSH_KEY}" ]]; then
  PROD_SSH_KEY="$(normalize_ssh_key_path "${PROD_SSH_KEY}")"
  SSH_KEY_HINT="${PROD_SSH_KEY}"
  if [[ ! -f "${PROD_SSH_KEY}" ]]; then
    echo "PROD_SSH_KEY file not found: ${PROD_SSH_KEY}" >&2
    exit 1
  fi
fi

SSH_PUBLIC_KEY_HINT="$(derive_ssh_public_key_path "${SSH_KEY_HINT}")"

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

SSH_KEY_ARGS=()
if [[ -n "${PROD_SSH_KEY}" ]]; then
  SSH_KEY_ARGS=(-i "${PROD_SSH_KEY}")
fi

if [[ "${DRY_RUN}" == "0" && "${SKIP_SSH_PRECHECK}" == "0" ]]; then
  SSH_CHECK_OUTPUT=""
  SSH_COPY_ID_EXAMPLE=(ssh-copy-id -i "${SSH_PUBLIC_KEY_HINT}")
  if [[ -n "${PROD_SSH_PORT}" ]]; then
    SSH_COPY_ID_EXAMPLE+=(-p "${PROD_SSH_PORT}")
  fi
  SSH_COPY_ID_EXAMPLE+=("${PROD_HOST}")

  echo "Checking SSH access to ${PROD_HOST}..."
  if ! SSH_CHECK_OUTPUT="$(
    ssh "${SSH_KEY_ARGS[@]}" "${SSH_PORT_ARGS[@]}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${PROD_HOST}" "echo deploy-ready" 2>&1
  )"; then
    echo "SSH check failed. Please configure key-based auth for ${PROD_HOST}."
    if [[ -n "${SSH_CHECK_OUTPUT}" ]]; then
      echo "SSH diagnostic: ${SSH_CHECK_OUTPUT}"
    fi
    if [[ "${SSH_CHECK_OUTPUT}" == *"Could not resolve hostname"* ]]; then
      echo "Hint: host '${PROD_HOST}' is not resolvable. Set PROD_HOST to an IP/FQDN or add a Host alias in ~/.ssh/config."
      if [[ "${PROD_HOST}" == "airis-prod" ]]; then
        echo "Example ~/.ssh/config entry:"
        echo "  Host airis-prod"
        echo "    HostName 185.130.212.71"
        echo "    User yan"
        echo "    IdentityFile ${SSH_KEY_HINT}"
        echo "    IdentitiesOnly yes"
      fi
    fi
    echo "Verify the key exists and is added to ~/.ssh/authorized_keys on the target host."
    echo "Tip: make sure your public key (${SSH_PUBLIC_KEY_HINT}) is in ~/.ssh/authorized_keys on the target host."
    echo "Example:"
    printf '  '
    printf '%q ' "${SSH_COPY_ID_EXAMPLE[@]}"
    printf '\n'
    exit 1
  fi
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

run ssh "${SSH_KEY_ARGS[@]}" "${SSH_PORT_ARGS[@]}" "${PROD_HOST}" "bash -lc $(q "${REMOTE_CMD}")"

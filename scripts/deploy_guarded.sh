#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/deploy_guarded.sh --tag <immutable-tag> [options]

Required:
  --tag TAG          Image tag already built and approved for production.

Options:
  --no-pull          Use an image preloaded on the target (for offline import).
  --dry-run          Print the plan without connecting to the target.
  -y, --yes          Skip the confirmation prompt.
  -h, --help         Show this help.

Environment (or .env.deploy):
  IMAGE_REPO         Image repository (default: ghcr.io/open-webui/open-webui)
  PROD_HOST          SSH host (default: airis-prod)
  PROD_SSH_USER      SSH user
  PROD_SSH_PORT      SSH port
  PROD_SSH_KEY       SSH private key
  PROD_PATH          Remote Compose project (default: /opt/projects/open-webui)
  BACKUP_ROOT        Remote backup root (default: /opt/backups/airis)
  HEALTH_URL         Remote health URL (default: http://127.0.0.1:3000/health)
  MIN_FREE_GB        Required free space on target (default: 10)
USAGE
}

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"
if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  set -a
  # The deploy env is operator-controlled and contains only KEY=VALUE entries.
  # shellcheck disable=SC1090
  source "${DEPLOY_ENV_FILE}"
  set +a
fi

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/open-webui/open-webui}"
PROD_HOST="${PROD_HOST:-airis-prod}"
PROD_SSH_USER="${PROD_SSH_USER:-}"
PROD_SSH_PORT="${PROD_SSH_PORT:-}"
PROD_SSH_KEY="${PROD_SSH_KEY:-}"
PROD_PATH="${PROD_PATH:-/opt/projects/open-webui}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/airis}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"
MIN_FREE_GB="${MIN_FREE_GB:-10}"

TAG=""
NO_PULL=0
DRY_RUN=0
AUTO_APPROVE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --no-pull)
      NO_PULL=1
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

if [[ -z "${TAG}" ]]; then
  echo "--tag is required; deploy only immutable, approved image tags." >&2
  exit 2
fi

if [[ "${AUTO_APPROVE}" != "1" && "${DRY_RUN}" != "1" ]]; then
  read -r -p "Deploy ${IMAGE_REPO}:${TAG} to ${PROD_HOST}? [y/N] " answer
  case "${answer}" in
    y|Y|yes|YES) ;;
    *) echo "Cancelled."; exit 1 ;;
  esac
fi

SSH_TARGET="${PROD_HOST}"
if [[ -n "${PROD_SSH_USER}" ]]; then
  SSH_TARGET="${PROD_SSH_USER}@${PROD_HOST}"
fi

SSH_ARGS=(-o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
if [[ -n "${PROD_SSH_PORT}" ]]; then
  SSH_ARGS+=(-p "${PROD_SSH_PORT}")
fi
if [[ -n "${PROD_SSH_KEY}" ]]; then
  if [[ "${PROD_SSH_KEY}" == "~/"* ]]; then
    PROD_SSH_KEY="${HOME}${PROD_SSH_KEY#"~"}"
  fi
  [[ -f "${PROD_SSH_KEY}" ]] || { echo "SSH key not found: ${PROD_SSH_KEY}" >&2; exit 1; }
  SSH_ARGS+=(-i "${PROD_SSH_KEY}")
fi

echo "Guarded deploy plan"
echo "  image: ${IMAGE_REPO}:${TAG}"
echo "  target: ${SSH_TARGET}:${PROD_PATH}"
echo "  backup root: ${BACKUP_ROOT}"
echo "  image pull: $([[ "${NO_PULL}" == "1" ]] && echo disabled || echo enabled)"

if [[ "${DRY_RUN}" == "1" ]]; then
  exit 0
fi

ssh "${SSH_ARGS[@]}" "${SSH_TARGET}" bash -s -- \
  "${TAG}" "${IMAGE_REPO}" "${PROD_PATH}" "${BACKUP_ROOT}" \
  "${HEALTH_URL}" "${MIN_FREE_GB}" "${NO_PULL}" <<'REMOTE'
set -Eeuo pipefail

tag="$1"
image_repo="$2"
project_path="$3"
backup_root="$4"
health_url="$5"
min_free_gb="$6"
no_pull="$7"
image_ref="${image_repo}:${tag}"
compose=(docker compose -f docker-compose.yaml -f docker-compose.prod.yml)
release_id="$(date -u +%Y%m%dT%H%M%SZ)-${tag//[^A-Za-z0-9_.-]/-}"
backup_dir="${backup_root}/${release_id}"
rollback_tag="rollback-${release_id}"
rollback_ref="airis:${rollback_tag}"
rollout_started=0
deployment_succeeded=0

cd "${project_path}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

wait_for_health() {
  local attempts="$1"
  local i
  for i in $(seq 1 "${attempts}"); do
    if curl -fsS --max-time 5 "${health_url}" 2>/dev/null \
      | tr -d '[:space:]' | grep -q '"status":true'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback_container() {
  echo "Rollout health gate failed; restoring previous image only."
  if ! docker image inspect "${rollback_ref}" >/dev/null 2>&1; then
    echo "Previous image is unavailable locally; manual rollback is required." >&2
    return 1
  fi
  WEBUI_IMAGE=airis WEBUI_DOCKER_TAG="${rollback_tag}" \
    "${compose[@]}" up -d --no-build --force-recreate --remove-orphans airis
  if wait_for_health 30; then
    echo "Previous container image is healthy again."
  else
    echo "Previous image was started but health did not recover; investigate immediately." >&2
    return 1
  fi
  echo "Database was not downgraded automatically. If the migration is incompatible, use ${backup_dir}/airis.dump after an explicit incident decision."
}

on_exit() {
  local status="$?"
  if [[ "${status}" -ne 0 && "${rollout_started}" == "1" && "${deployment_succeeded}" == "0" ]]; then
    rollback_container || true
  fi
  exit "${status}"
}
trap on_exit EXIT

command -v docker >/dev/null || fail "docker is required on the target"
command -v curl >/dev/null || fail "curl is required on the target for the health gate"

free_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
required_kb="$((min_free_gb * 1024 * 1024))"
(( free_kb >= required_kb )) || fail "target has less than ${min_free_gb} GiB free on /"
docker inspect airis >/dev/null 2>&1 || fail "running airis container not found"
docker inspect airis-postgres >/dev/null 2>&1 || fail "airis-postgres container not found"
docker inspect --format '{{.State.Health.Status}}' airis-postgres | grep -q healthy \
  || fail "airis-postgres is not healthy"

previous_image_id="$(docker inspect --format '{{.Image}}' airis)"
previous_image_ref="$(docker inspect --format '{{.Config.Image}}' airis)"
docker image inspect "${previous_image_id}" >/dev/null \
  || fail "previous airis image is not available for rollback"

mkdir -p "${backup_dir}"
{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "release=${image_ref}"
  echo "previous_image=${previous_image_ref}"
  echo "previous_image_id=${previous_image_id}"
  WEBUI_IMAGE="${image_repo}" WEBUI_DOCKER_TAG="${tag}" \
    "${compose[@]}" config --images
} > "${backup_dir}/metadata.txt"

echo "Creating PostgreSQL backup: ${backup_dir}"
docker exec airis-postgres sh -c \
  'pg_dump -Fc --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "${backup_dir}/airis.dump"
docker exec airis-postgres sh -c \
  'pg_dumpall --globals-only -U "$POSTGRES_USER"' \
  > "${backup_dir}/globals.sql"

echo "Creating application-data backup: ${backup_dir}/airis-data.tar.gz"
docker exec airis sh -c 'tar -C /app/backend/data -czf - .' \
  > "${backup_dir}/airis-data.tar.gz"

sha256sum "${backup_dir}/airis.dump" "${backup_dir}/globals.sql" \
  "${backup_dir}/airis-data.tar.gz" > "${backup_dir}/SHA256SUMS"
sha256sum -c "${backup_dir}/SHA256SUMS"
tar -tzf "${backup_dir}/airis-data.tar.gz" >/dev/null
docker run --rm --network none -v "${backup_dir}:/backup:ro" postgres:16-alpine \
  pg_restore --list /backup/airis.dump > "${backup_dir}/pg_restore.list"

if [[ "${no_pull}" == "0" ]]; then
  echo "Pulling immutable image ${image_ref}"
  docker pull "${image_ref}"
else
  echo "Using preloaded immutable image ${image_ref}"
fi
docker image inspect "${image_ref}" >/dev/null || fail "target image is unavailable"
platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "${image_ref}")"
[[ "${platform}" == "linux/amd64" ]] || fail "expected linux/amd64 image, got ${platform}"

echo "Running hard Alembic migration gate"
if ! WEBUI_IMAGE="${image_repo}" WEBUI_DOCKER_TAG="${tag}" \
  "${compose[@]}" run --rm --no-deps --entrypoint bash \
  -e ENABLE_DB_MIGRATIONS=false airis -lc \
  'cd /app/backend/open_webui && python -m alembic -c alembic.ini upgrade head' \
  </dev/null; then
  fail "hard Alembic migration gate failed; airis was not recreated"
fi
echo "Migration gate passed"

docker tag "${previous_image_ref}" "${rollback_ref}"
echo "Previous image retained as ${rollback_ref}"
rollout_started=1
echo "Recreating only airis with ${image_ref}"
WEBUI_IMAGE="${image_repo}" WEBUI_DOCKER_TAG="${tag}" \
  "${compose[@]}" up -d --no-build --force-recreate --remove-orphans airis

echo "Waiting for application health"
wait_for_health 60 || fail "health endpoint did not report status=true"
actual_image="$(docker inspect --format '{{.Config.Image}}' airis)"
[[ "${actual_image}" == "${image_ref}" ]] || fail "running image is ${actual_image}, expected ${image_ref}"
docker exec airis-postgres sh -c \
  'psql -Atq -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select version_num from alembic_version"'
docker ps --filter name='^/airis$' --filter status=running --format '{{.Names}} {{.Status}}' \
  | grep -q '^airis ' || fail "airis is not running"

deployment_succeeded=1
trap - EXIT
echo "Guarded deploy completed. Backup: ${backup_dir}"
REMOTE

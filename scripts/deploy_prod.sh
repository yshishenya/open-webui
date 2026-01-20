#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"
if [[ -f "${DEPLOY_ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  set -a
  . "${DEPLOY_ENV_FILE}"
  set +a
fi

TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE_REPO="${IMAGE_REPO:-yshishenya/yshishenya}"
PROD_HOST="${PROD_HOST:-airis-prod}"
PROD_PATH="${PROD_PATH:-/opt/projects/open-webui}"
PROD_SSH_PORT="${PROD_SSH_PORT:-}"
PROD_GIT_PULL="${PROD_GIT_PULL:-1}"
POST_DEPLOY_STATUS="${POST_DEPLOY_STATUS:-1}"
COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.prod.yml"

echo "Building ${IMAGE_REPO}:${TAG}..."
docker build -t "${IMAGE_REPO}:${TAG}" .

echo "Pushing ${IMAGE_REPO}:${TAG}..."
docker push "${IMAGE_REPO}:${TAG}"

SSH_PORT_ARGS=()
if [[ -n "${PROD_SSH_PORT}" ]]; then
  SSH_PORT_ARGS=(-p "${PROD_SSH_PORT}")
fi

echo "Deploying to ${PROD_HOST}..."
REMOTE_CMD="cd ${PROD_PATH} && "
if [[ "${PROD_GIT_PULL}" == "1" ]]; then
  REMOTE_CMD+="git pull --ff-only && "
fi
REMOTE_CMD+="WEBUI_IMAGE=${IMAGE_REPO} WEBUI_DOCKER_TAG=${TAG} docker compose ${COMPOSE_FILES} pull && "
REMOTE_CMD+="WEBUI_IMAGE=${IMAGE_REPO} WEBUI_DOCKER_TAG=${TAG} docker compose ${COMPOSE_FILES} up -d --remove-orphans --no-build"
if [[ "${POST_DEPLOY_STATUS}" == "1" ]]; then
  REMOTE_CMD+=" && WEBUI_IMAGE=${IMAGE_REPO} WEBUI_DOCKER_TAG=${TAG} docker compose ${COMPOSE_FILES} ps"
fi

ssh "${SSH_PORT_ARGS[@]}" "${PROD_HOST}" "${REMOTE_CMD}"

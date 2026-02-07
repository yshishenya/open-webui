#!/bin/bash

image_name="airis"
container_name="airis"
host_port=3000
container_port=8080

docker build -t "$image_name" .
docker stop "$container_name" &>/dev/null || true
docker rm "$container_name" &>/dev/null || true

docker run -d -p "$host_port":"$container_port" \
    --add-host=host.docker.internal:host-gateway \
    -v "${image_name}:/app/backend/data" \
    --name "$container_name" \
    --restart always \
    "$image_name"

# Opt-in cleanup: keep this disabled by default to preserve Docker build cache.
# Enable explicitly with `AIRIS_PRUNE_IMAGES=true`.
if [ "${AIRIS_PRUNE_IMAGES:-false}" = "true" ]; then
    docker image prune -f
else
    if [ -t 1 ]; then
        echo "Note: docker image prune is disabled by default to preserve build cache. Set AIRIS_PRUNE_IMAGES=true to enable." >&2
    fi
fi

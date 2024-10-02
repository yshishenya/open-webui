#!/bin/bash

image_name="open-webui"
container_name="open-webui"
host_port=3287
container_port=8080

docker build -t "$image_name" .
docker stop "$container_name" &>/dev/null || true
docker rm "$container_name" &>/dev/null || true

docker run -d -p "$host_port":"$container_port" \
    --add-host=host.docker.internal:host-gateway \
    -v "$(pwd)/backend/data:/app/backend/data" \
    -e OPENAI_API_BASE_URLS="https://api.openai.com/v1" \
    -e OPENAI_API_KEY="$OPENAI_API_KEY" \
    -e WEBUI_NAME="P4.0 GPT" \
    -e WEBUI_URL="http://localhost:3287" \
    -e DATA_DIR="/app/backend/data" \
    -e ENABLE_SIGNUP=true \
    -e DEFAULT_USER_ROLE="pending" \
    -e ENABLE_ADMIN_EXPORT=true \
    -e PORT="$container_port" \
    -e ENABLE_OLLAMA_API=false \
    -e ENABLE_OPENAI_API=true \
    -e ENABLE_RAG_WEB_SEARCH=true \
    -e RAG_WEB_SEARCH_ENGINE="duckduckgo" \
    -e AUDIO_STT_ENGINE="openai" \
    -e AUDIO_TTS_ENGINE="openai" \
    -e ENABLE_IMAGE_GENERATION=true \
    -e IMAGE_GENERATION_ENGINE="openai" \
    -e IMAGE_GENERATION_API_KEY="$OPENAI_API_KEY" \
    -e IMAGE_GENERATION_API_BASE_URL="https://api.openai.com/v1" \
    -e IMAGE_GENERATION_API_MODEL="dall-e-3" \
    -e IMAGE_GENERATION_API_MAX_NUM_RESULTS=1 \
    -e IMAGE_GENERATION_API_SIZE="1024x1024" \
    -e IMAGE_GENERATION_API_QUALITY="standard" \
    -e DEFAULT_MODELS="gpt-4o-mini,gpt-4o" \
    --name "$container_name" \
    --restart always \
    "$image_name"

docker image prune -f

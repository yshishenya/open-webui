#!/usr/bin/env bash
set -euo pipefail

if [[ ! -t 0 ]]; then
  echo "This script is interactive. Run it from a terminal."
  exit 1
fi

BASE_FILE="${BASE_FILE:-docker-compose.yaml}"
DEV_FILE="${DEV_FILE:-docker-compose.dev.yaml}"

if ! [[ -f "$BASE_FILE" && -f "$DEV_FILE" ]]; then
  echo "Compose files not found: $BASE_FILE, $DEV_FILE"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose not found."
  exit 1
fi

FILES=(-f "$BASE_FILE" -f "$DEV_FILE")

compose() {
  "${COMPOSE[@]}" "${FILES[@]}" "$@"
}

confirm() {
  local prompt="${1:-Are you sure?}"
  local answer
  read -r -p "$prompt [y/N]: " answer
  [[ "${answer,,}" == "y" || "${answer,,}" == "yes" ]]
}

print_header() {
  echo "Airis dev stack helper"
  echo "Compose files: $BASE_FILE + $DEV_FILE"
  echo "Backend: http://localhost:${OPEN_WEBUI_API_PORT-8080}"
  echo "Frontend: http://localhost:${AIRIS_FRONTEND_PORT-5173}"
  echo
}

print_header

print_help() {
  echo "Help"
  echo "- Dev up (foreground): run live dev stack and keep logs in this terminal."
  echo "- Dev up (detached): run live dev stack in background."
  echo "- Dev up (detached, build): rebuild images first (deps/base changes)."
  echo "- Backend only: start API with auto-reload."
  echo "- Frontend only: start Vite dev server with HMR."
  echo "- Logs: tail logs from selected service."
  echo "- Stop: stop containers without removing them."
  echo "- Down (keep volumes): remove containers, keep DB/data volumes."
  echo "- Down (remove volumes): remove containers + DB/data volumes (full reset)."
  echo "- Rebuild backend image: rebuild only backend image."
  echo "- Install frontend deps: npm ci into the node_modules volume."
  echo "- Status: list running services."
  echo
}

describe_action() {
  case "$1" in
    1) echo "Run live dev stack in this terminal (fastest feedback, logs visible).";;
    2) echo "Run live dev stack in background (use Logs to follow).";;
    3) echo "Rebuild images then run live dev stack in background.";;
    4) echo "Start only backend with auto-reload."; return 0;;
    5) echo "Start only frontend with Vite HMR."; return 0;;
    6) echo "Stream logs from selected service."; return 0;;
    7) echo "Stop containers without removing them."; return 0;;
    8) echo "Remove containers but keep volumes (DB/data preserved)."; return 0;;
    9) echo "Remove containers and volumes (DB/data wiped)."; return 0;;
    10) echo "Rebuild backend image only."; return 0;;
    11) echo "Install frontend deps into node_modules volume."; return 0;;
    12) echo "Show running services."; return 0;;
    13) echo "Exit."; return 0;;
    *) echo "Invalid selection."; return 1;;
  esac
}

PS3="Select action: "
select action in \
  "Dev up (foreground, no rebuild) — live dev + logs, fastest start" \
  "Dev up (detached, no rebuild) — live dev in background" \
  "Dev up (detached, build) — rebuild images first (deps/base changes)" \
  "Backend only (foreground) — API with auto-reload" \
  "Frontend only (foreground) — Vite HMR dev server" \
  "Logs (follow) — stream container logs" \
  "Stop — stop running containers" \
  "Down (keep volumes) — remove containers, keep DB/data" \
  "Down (remove volumes) — full reset incl. DB/data" \
  "Rebuild backend image — only backend image" \
  "Install frontend deps (npm ci) — refresh node_modules volume" \
  "Status — show running services" \
  "Help — show mode descriptions" \
  "Exit"
do
  if [[ "$REPLY" -ne 14 ]]; then
    describe_action "$REPLY"
  fi
  if [[ "$REPLY" -ge 1 && "$REPLY" -le 12 ]]; then
    if ! confirm "Proceed with this action?"; then
      echo "Canceled."
      echo
      print_header
      continue
    fi
  fi
  case "$REPLY" in
    1)
      compose up
      ;;
    2)
      compose up -d
      ;;
    3)
      compose up -d --build
      ;;
    4)
      compose up airis
      ;;
    5)
      compose up airis-frontend
      ;;
    6)
      read -r -p "Service (airis/airis-frontend/postgres/all) [all]: " service
      if [[ -z "$service" || "$service" == "all" ]]; then
        compose logs -f --tail=200
      else
        compose logs -f --tail=200 "$service"
      fi
      ;;
    7)
      compose stop
      ;;
    8)
      compose down
      ;;
    9)
      if confirm "Remove volumes? This deletes local DB/data."; then
        compose down -v
      fi
      ;;
    10)
      compose build airis
      ;;
    11)
      compose run --rm airis-frontend sh -lc "npm ci --force"
      ;;
    12)
      compose ps
      ;;
    13)
      print_help
      ;;
    14)
      exit 0
      ;;
    *)
      echo "Invalid selection."
      ;;
  esac
  echo
  print_header
done

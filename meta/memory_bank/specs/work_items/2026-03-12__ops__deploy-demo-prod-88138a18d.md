# [OPS][DEPLOY] Promote image `88138a18d` to demo/prod

## Context

After merging PR #80 (`5cac5c16ccc2b6b41fb264473b7604b3fcaf6fca`) the requested operational task was to deploy the current `airis_b2c` state to both demo and prod using the same image tag for deterministic promotion.

## Scope

- Build and push `yshishenya/yshishenya:88138a18d`
- Deploy the same tag to `prod`
- Attempt deploy to `demo`
- Record blockers if any target cannot be reached

## Outcome

- Built and pushed `yshishenya/yshishenya:88138a18d`
- `demo` deployed successfully on the current server after confirming `dev.chat.airis.you` resolves to this machine and should be updated locally, not via SSH loopback
- `prod` deployed successfully on `185.130.212.71`

## Verification

- Local build: `docker build -t yshishenya/yshishenya:88138a18d .`
- Push result: `88138a18d: digest: sha256:62c51d51ae75f3da24e10524194c43664cedc389b22b02e054bbd758b6b04e6f`
- Demo deploy:
  - local `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=88138a18d docker compose -f docker-compose.yaml -f docker-compose.prod.yml pull`
  - local `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=88138a18d docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - local `docker inspect airis` => `status=running health=healthy restarts=0`
  - local `curl -sS http://localhost:3000/health` => `{"status":true}`
  - external `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`
- Prod deploy:
  - remote `git pull --ff-only`
  - remote `docker compose -f docker-compose.yaml -f docker-compose.prod.yml pull`
  - remote `docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - remote `docker inspect airis` => `status=running health=healthy restarts=0`
  - remote `curl -sS http://localhost:3000/health` => `{"status":true}`
- external `curl -sS https://chat.airis.you/health` => `{"status":true}`

## Notes

Initial demo deploy via `scripts/deploy_target.sh --target demo` stopped on SSH precheck because local target config assumes remote access to `dev.chat.airis.you`. That assumption was wrong for this machine: the demo host is the current server, so the correct recovery path was a local `docker compose pull/up` using the same promoted tag.

Earlier SSH probes that failed before this clarification:
  - `~/.ssh/airis_prod`
  - `~/.ssh/id_rsa`
  - `~/.ssh/github_ed25519`

# [OPS][DEPLOY] Promote merged release `47ff7292a` to demo/prod

## Context

After merging PR #81 (`47ff7292a1ae70d4c2cf271e333fc9ce0555fd61`) the requested operational task was to build the current `airis_b2c` state as a clean image and promote the exact same release to both demo and prod.

## Scope

- Build `yshishenya/yshishenya:47ff7292a` from the merged `airis_b2c` HEAD
- Push the image to Docker Hub
- Deploy the same tag to local demo (`dev.chat.airis.you`)
- Deploy the same tag to prod (`185.130.212.71`)
- Verify both internal container health and public `/health`

## Outcome

- Built and pushed `yshishenya/yshishenya:47ff7292a`
- Updated demo on the current server to the new tag
- Updated prod on `185.130.212.71` to the same tag
- Confirmed both environments serve healthy application responses after recreate

## Verification

- Local build: `docker build -t yshishenya/yshishenya:47ff7292a .`
- Push result: `47ff7292a: digest: sha256:4068d73ec346e2f0a7f7d7f03ab1ab2b653ec2df3b16d852dbff51e03a5ea141`
- Demo deploy:
  - local `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=47ff7292a docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - local `docker inspect airis` => `image=yshishenya/yshishenya:47ff7292a health=healthy restarts=0`
  - external `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`
- Prod deploy:
  - remote `git pull --ff-only`
  - remote `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=47ff7292a docker compose -f docker-compose.yaml -f docker-compose.prod.yml pull`
  - remote `WEBUI_IMAGE=yshishenya/yshishenya WEBUI_DOCKER_TAG=47ff7292a docker compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --remove-orphans --no-build --force-recreate`
  - remote `docker inspect airis` => `image=yshishenya/yshishenya:47ff7292a health=healthy restarts=0`
  - remote `curl -sS http://localhost:3000/health` => `{"status":true}`
- Public checks:
  - `curl -sS https://dev.chat.airis.you/health` => `{"status":true}`
  - `curl -sS https://chat.airis.you/health` => `{"status":true}`

## Notes

During prod container recreation the external health endpoint briefly returned `502` while the container health state was still `starting`; the service recovered to `healthy` without manual intervention a few seconds later.

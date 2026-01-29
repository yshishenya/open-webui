# Production Deploy (Docker Hub + SSH)

This guide describes the one-command deploy flow from the dev server to production.
The dev server builds and pushes the image to Docker Hub, then triggers the prod
server to pull and restart the container.

## One-time setup (prod server)

1. Ensure the repo exists on prod:

```bash
cd /opt/projects/open-webui
```

2. Ensure a valid `.env` exists on prod (production settings).

3. If the Docker Hub repo is private, login once:

```bash
docker login
```

## One-time setup (dev server)

1. Ensure SSH access to prod works (recommended alias in `~/.ssh/config`):

```sshconfig
Host airis-prod
  HostName 185.130.212.71
  User yan
  IdentityFile ~/.ssh/airis_prod
  IdentitiesOnly yes
```

2. Create `.env.deploy` in the repo root:

```bash
PROD_HOST=airis-prod
PROD_PATH=/opt/projects/open-webui
IMAGE_REPO=yshishenya/yshishenya
# PROD_SSH_PORT=22
# PROD_GIT_PULL=1
# POST_DEPLOY_STATUS=1
```

## Deploy

From the dev server:

```bash
scripts/deploy_prod.sh
```

Optional: deploy a specific tag:

```bash
scripts/deploy_prod.sh v0.6.41
```

What the script does:

1. `docker build` on dev
2. `docker push` to Docker Hub
3. `git pull --ff-only` on prod (optional, `PROD_GIT_PULL=1`)
4. `docker compose pull` on prod
5. `docker compose up -d --remove-orphans --no-build` on prod
6. `docker compose ps` on prod (optional, `POST_DEPLOY_STATUS=1`)

## Rollback

Redeploy the previous tag:

```bash
scripts/deploy_prod.sh <previous-tag>
```

## Data safety

Production data is stored in Docker volumes (`postgres-data`, `airis`).
This deploy flow keeps volumes intact. Do NOT run:

```bash
docker compose down -v
```

## Troubleshooting

- Auth error on pull: run `docker login` on prod.
- Container fails to start:
  ```bash
  ssh airis-prod "cd /opt/projects/open-webui && docker compose -f docker-compose.yaml -f docker-compose.prod.yml logs -f airis"
  ```
- Compose changes on dev: update prod repo manually (e.g. `git pull`) before deploy.

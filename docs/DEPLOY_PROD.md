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

By default, when run in a terminal with no flags, the script will prompt an interactive dialog.
For automation, pass flags and/or use `--non-interactive`.

Optional: deploy a specific tag (positional arg, backward-compatible):

```bash
scripts/deploy_prod.sh v0.6.41
```

Optional: deploy a specific tag (flag form):

```bash
scripts/deploy_prod.sh --tag v0.6.41
```

Optional: fast rebuild using cache, but always pick a unique tag:

```bash
scripts/deploy_prod.sh --unique-tag
```

Optional: rebuild without cache (clean build):

```bash
scripts/deploy_prod.sh --no-cache
```

Optional: rebuild without cache and also refresh base layers:

```bash
scripts/deploy_prod.sh --no-cache --pull
```

Optional: force restart on prod even if Compose thinks nothing changed:

```bash
scripts/deploy_prod.sh --force-recreate
```

Optional: force interactive or disable it:

```bash
scripts/deploy_prod.sh --interactive
scripts/deploy_prod.sh --non-interactive
```

Tagging behavior (when no tag is provided):

- Clean working tree: tag is `<short-sha>`
- Dirty working tree (uncommitted changes): tag is `<short-sha>-dirty-<hash>`
- With `--unique-tag`: adds a UTC timestamp suffix

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

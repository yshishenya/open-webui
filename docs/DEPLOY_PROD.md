# Deploy to Demo/Prod (Docker Hub + SSH)

This guide describes deploy flow from the dev server to remote targets (`demo`, `prod`).
The dev server builds and pushes the image to Docker Hub, then triggers a target host
to pull and restart the container.

## One-time setup (target servers)

1. Ensure the repo exists on each target server:

```bash
cd /opt/projects/open-webui
```

2. Ensure a valid `.env` exists on each target (target-specific settings).

3. If the Docker Hub repo is private, login once on each target:

```bash
docker login
```

## One-time setup (dev server)

1. Ensure SSH access works for demo/prod hosts:

```sshconfig
Host airis-prod
  HostName 185.130.212.71
  User yan
  IdentityFile ~/.ssh/airis_prod
  IdentitiesOnly yes

Host airis-demo
  HostName <demo-host-or-ip>
  User yan
  IdentityFile ~/.ssh/airis_demo
  IdentitiesOnly yes
```

2. Create local (gitignored) target config files from templates:

```bash
cp deploy/targets/prod.env.example .env.deploy.prod
cp deploy/targets/demo.env.example .env.deploy.demo
```

Edit `.env.deploy.prod` / `.env.deploy.demo` with real hosts, paths, keys.
Recommended: set `PROD_SSH_USER=yan` so deploy does not depend on your local OS username.

Recommended split:

- `.env.deploy.<target>`: shared stable target settings (`PROD_HOST`, `PROD_PATH`, `PROD_SSH_USER`)
- `.env.deploy.<target>.local`: machine-specific overrides (`PROD_SSH_KEY`, non-default SSH port)

Example:

```bash
cat > .env.deploy.demo.local <<'EOF'
PROD_SSH_KEY=~/.ssh/airis_demo
EOF
```

## Deploy

From the dev server:

```bash
scripts/deploy_target.sh --target prod
```

By default, when run in a terminal with no flags, the script will prompt an interactive dialog.
For automation, pass flags and/or use `--non-interactive`.

Optional: deploy a specific tag (positional arg, backward-compatible):

```bash
scripts/deploy_target.sh --target prod v0.6.41
```

Optional: deploy a specific tag (flag form):

```bash
scripts/deploy_target.sh --target prod --tag v0.6.41
```

Optional: fast rebuild using cache, but always pick a unique tag:

```bash
scripts/deploy_target.sh --target prod --unique-tag
```

Optional: rebuild without cache (clean build):

```bash
scripts/deploy_target.sh --target prod --no-cache
```

Optional: rebuild without cache and also refresh base layers:

```bash
scripts/deploy_target.sh --target prod --no-cache --pull
```

Optional: force restart on prod even if Compose thinks nothing changed:

```bash
scripts/deploy_target.sh --target prod --force-recreate
```

Optional: force interactive or disable it:

```bash
scripts/deploy_target.sh --target prod --interactive
scripts/deploy_target.sh --target prod --non-interactive
```

Optional: skip interactive prompts in one command and run immediately:

```bash
scripts/deploy_target.sh --target prod --yes --non-interactive --force-recreate
```

Optional: skip only SSH precheck when you already verified key access:

```bash
scripts/deploy_target.sh --target prod --yes --non-interactive --skip-precheck
```

Optional: run a no-op preview without executing:

```bash
scripts/deploy_target.sh --target prod --yes --non-interactive --dry-run
```

Deploy to demo:

```bash
scripts/deploy_target.sh --target demo --yes --non-interactive --dry-run
```

Tagging behavior (when no tag is provided):

- Clean working tree: tag is `<short-sha>`
- Dirty working tree (uncommitted changes): tag is `<short-sha>-dirty-<hash>`
- With `--unique-tag`: adds a UTC timestamp suffix

What the script does:

1. `docker build` on dev
2. `docker push` to Docker Hub
3. `git pull --ff-only` on target (optional, `PROD_GIT_PULL=1`)
4. `docker compose pull` on target
5. `docker compose up -d --remove-orphans --no-build` on target
6. `docker compose ps` on target (optional, `POST_DEPLOY_STATUS=1`)

Underlying engine remains `scripts/deploy_prod.sh`; `scripts/deploy_target.sh` only selects target config.

## Recommended release flow

1. Develop and test locally.
2. Deploy to demo:
   - `scripts/deploy_target.sh --target demo --unique-tag`
3. Verify demo.
4. Promote same tag to prod:
   - `scripts/deploy_target.sh --target prod --tag <approved-tag>`

## Rollback

Redeploy the previous tag:

```bash
scripts/deploy_target.sh --target prod <previous-tag>
```

## .env governance (avoid drift)

Use `.env.example` as the canonical key set and manage remote env files via target configs:

```bash
# List configured targets
python3 scripts/env_target_manager.py list

# Check key drift for demo/prod against .env.example
python3 scripts/env_target_manager.py check --target demo --target prod

# Sync missing keys on targets without overwriting existing values
python3 scripts/env_target_manager.py sync --target demo --target prod

# If target repo is intentionally behind local branch:
python3 scripts/env_target_manager.py sync --target prod --allow-template-mismatch
```

`sync` runs remote `scripts/sync_env.py`, which creates backups and preserves existing values.
By default it guards against local/remote `.env.example` hash mismatch to prevent accidental sync against stale templates.

## Data safety

Production data is stored in Docker volumes (`postgres-data`, `airis`).
This deploy flow keeps volumes intact. Do NOT run:

```bash
docker compose down -v
```

## Troubleshooting

- Auth error on pull: run `docker login` on prod.
- SSH auth error on deploy:
  - Precheck now prints `SSH diagnostic` with the underlying error (DNS/auth/etc.).
  - If you see `Permission denied (publickey,password)`, set `PROD_SSH_KEY=...` in `.env.deploy.<target>.local` or authorize your default SSH key on the target host.
  - Add deploy key to target host `authorized_keys`:
  ```bash
  ssh-copy-id -i ~/.ssh/airis_prod.pub yan@185.130.212.71
  ```
- First connection to a new target may require accepting the host key. The precheck uses `StrictHostKeyChecking=accept-new`, so the host key is added automatically on first successful reachability.
- If your local username differs from remote username, set `PROD_SSH_USER=yan` in `.env.deploy.<target>`.
- If host alias cannot be resolved, use direct IP/FQDN in `.env.deploy.<target>` (`PROD_HOST=...`).
- If you see `scripts/deploy_prod.sh: ...: command not found`, check `.env.deploy.<target>` for non `KEY=VALUE` lines — only assignments are valid.
- Container fails to start:
  ```bash
  ssh airis-prod "cd /opt/projects/open-webui && docker compose -f docker-compose.yaml -f docker-compose.prod.yml logs -f airis"
  ```
- Compose changes on dev: update prod repo manually (e.g. `git pull`) before deploy.

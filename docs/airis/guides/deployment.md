# Deployment (Production)

Airis production deploy is currently documented in `docs/DEPLOY_PROD.md` and implemented by `scripts/deploy_prod.sh`.

## Start here

- Deploy guide: [`docs/DEPLOY_PROD.md`](../../../docs/DEPLOY_PROD.md)

## Notes

- The deploy flow builds and pushes an image on the dev server, then pulls/restarts on prod.
- Production data lives in Docker volumes; avoid destructive commands like `docker compose down -v` on prod unless you intend to wipe data.

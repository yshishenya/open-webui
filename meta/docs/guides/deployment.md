# Deployment (Demo/Prod)

Airis deploy flow is documented in `docs/DEPLOY_PROD.md`.

## Start here

- Deploy guide: [`docs/DEPLOY_PROD.md`](../../../docs/DEPLOY_PROD.md)

## Notes

- Target wrapper: `scripts/deploy_target.sh --target demo|prod ...`
- Deploy engine: `scripts/deploy_prod.sh` (called by the wrapper).
- Env governance tool: `python3 scripts/env_target_manager.py check|sync --target ...`
- Recommended local config split:
  - `.env.deploy.<target>` for shared target settings
  - `.env.deploy.<target>.local` for machine-specific SSH overrides
- The deploy flow builds and pushes an image on the dev server, then pulls/restarts on target host.
- Production data lives in Docker volumes; avoid destructive commands like `docker compose down -v` on prod unless you intend to wipe data.

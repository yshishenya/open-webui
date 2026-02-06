# Troubleshooting (Airis)

## Dev stack issues (Docker Compose)

- Use the interactive helper: `./scripts/dev_stack.sh`
- Full reset (destructive): `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml down -v`

## Missing frontend deps in Docker

If frontend tests/lint complain about missing tools, use the Docker wrappers (they install deps into the volume when needed):

- `npm run docker:test:frontend`
- `npm run docker:lint:frontend`
- `npm run docker:check:frontend`

## Billing/YooKassa problems

- Follow the setup guide: [billing_setup.md](../guides/billing_setup.md)
- Check backend logs: `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f airis`

## Upstream issues

If behaviour differs from upstream Open WebUI, check whether the file is upstream-owned and whether an Airis thin-hook is involved:

- `meta/memory_bank/guides/upstream_sync.md`

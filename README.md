# AIris

AIris is a private fork for personal use.

## Installation

### Docker

```bash
docker compose up -d
```

### Development

```bash
npm install
npm run dev
```

## Configuration

Configure via environment variables. See `.env.example` for available options.

## Branding and Logos

AIris is a debranded fork of Open WebUI. To customize the visual branding:

- Update the application name via the `WEBUI_NAME` environment variable.
- Replace the logo and favicon assets in `static/static/` (for example, `favicon.png`, `favicon-dark.png`, `favicon-96x96.png`, `favicon.ico`, `favicon.svg`).
- Replace splash screen and PWA icons in `static/static/` (`splash.png`, `splash-dark.png`, `logo.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`).
- Rebuild and restart the app (e.g. `npm run build` or Docker image rebuild) so the new assets are served.

## License

See [LICENSE](LICENSE) file.

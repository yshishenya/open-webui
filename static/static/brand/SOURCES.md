# Brand Assets Sources

These assets are used to render official provider icons on the `/auth` page.
They are sourced from providers' official brand resources (or official logos mirrored on Wikimedia) and stored locally to avoid runtime external fetches.

## Sources (retrieved 2026-02-09)

- Telegram: `https://telegram.org/img/t_logo.svg`
- VK: `https://upload.wikimedia.org/wikipedia/commons/f/f3/VK_Compact_Logo_%282021-present%29.svg` (used on `https://en.wikipedia.org/wiki/VK_(company)`) (background removed to match uniform icon button style)
- OK: `https://upload.wikimedia.org/wikipedia/commons/5/5e/Logo_Odnoklassniki_2023.svg` (used on `https://en.wikipedia.org/wiki/Odnoklassniki`)
- Mail.ru: `https://upload.wikimedia.org/wikipedia/commons/0/06/Mail_Logo_2024.svg` (used on Wikimedia Commons) (wordmark removed to keep the `@` icon only)
- GitHub: `https://brand.github.com/` (`GitHub_Logos.zip`, file `GitHub Logos/SVG/GitHub_Invertocat_White.svg`)
- Yandex: `https://yandex.ru/apple-touch-icon.png` (served from yastatic; stored as PNG for the login button icon)

## Notes

- Logos are trademarks of their respective owners.
- Do not modify the logo artwork beyond resizing for UI layout (except where noted: background removal for uniform icon buttons).

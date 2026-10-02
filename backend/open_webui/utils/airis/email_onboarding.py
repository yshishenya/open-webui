"""First-cycle mail uses the existing public guide and its prepared task."""

from urllib.parse import urlsplit


def first_email_context(base: str, name: str) -> dict[str, str]:
    """Allow only the AIRIS chat origin; no client redirect or duplicate prompts."""
    parsed = urlsplit(base)
    if (
        parsed.scheme != 'https'
        or parsed.hostname != 'chat.airis.you'
        or parsed.port not in {None, 443}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {'', '/'}
        or parsed.query
        or parsed.fragment
        or any(c.isspace() for c in base)
    ):
        raise ValueError('Invalid AIRIS onboarding origin')
    origin = 'https://chat.airis.you'
    return {
        'name': name,
        'first_task_url': origin + '/guide#example-letter',
        'guide_url': origin + '/guide',
        'dashboard_url': origin + '/',
    }

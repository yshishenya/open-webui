"""Keep public unsubscribe secrets out of application access logs."""

import re

_ONE_CLICK = re.compile(r'(/api/v1/email-preferences/one-click/)[^\s"<>]+')


def redact_email_tokens(message: str) -> str:
    return _ONE_CLICK.sub(r'\1[redacted]', message)


def is_email_preference_path(path: str) -> bool:
    return path == '/api/v1/email-preferences' or path.startswith('/api/v1/email-preferences/')

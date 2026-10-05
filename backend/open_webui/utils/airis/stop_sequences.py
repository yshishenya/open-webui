import re


def _decode_escape(match: re.Match[str]) -> str:
    escape = match.group()
    if len(escape) == 2 and ord(escape[1]) > 127:
        return escape
    return escape.encode('ascii').decode('unicode_escape')


def decode_stop_sequences(value: str | list[str]) -> list[str]:
    """Decode model stop escapes without splitting strings or corrupting Unicode."""
    if isinstance(value, str):
        value = [value] if value else []
    if not isinstance(value, list) or not all(isinstance(sequence, str) for sequence in value):
        raise ValueError('Stop sequences must be a string or a list of strings')
    # Decode only original escapes; encoding all Unicode invents escapes after backslashes.
    return [
        re.sub(r'\\(?:N\{[^}]*\}|u.{0,4}|U.{0,8}|x.{0,2}|[0-7]{1,3}|.)|\\$', _decode_escape, sequence, flags=re.DOTALL)
        for sequence in value
    ]

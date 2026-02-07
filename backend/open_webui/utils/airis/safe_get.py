from __future__ import annotations

from collections.abc import Mapping, Sequence


def deep_get_mapping(root: Mapping[str, object], keys: Sequence[str]) -> Mapping[str, object]:
    """Safely descend into nested mappings.

    Production data can contain explicit JSON nulls for fields that code assumes
    are dicts. This helper avoids `'NoneType' object has no attribute 'get'` by
    returning an empty mapping when the path is missing or not a mapping.
    """

    current: object = root
    for key in keys:
        if not isinstance(current, Mapping):
            return {}
        current = current.get(key)

    return current if isinstance(current, Mapping) else {}


def deep_get_bool(root: Mapping[str, object], keys: Sequence[str], default: bool) -> bool:
    """Safely descend into nested mappings and coerce the leaf to a bool.

    If the leaf is missing, null, or an unexpected type, returns `default`.
    """

    current: object = root
    for key in keys:
        if not isinstance(current, Mapping):
            return default
        current = current.get(key)

    if current is None:
        return default
    if isinstance(current, bool):
        return current

    # Common DB/JSON encodings.
    if isinstance(current, int):
        return bool(current)
    if isinstance(current, str):
        value = current.strip().lower()
        if value in {"1", "true", "yes", "y", "on"}:
            return True
        if value in {"0", "false", "no", "n", "off"}:
            return False

    return default


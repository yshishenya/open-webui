def decode_stop_sequences(value: str | list[str]) -> list[str]:
    """Decode model stop escapes without splitting strings or corrupting Unicode."""
    if isinstance(value, str):
        value = [value] if value else []
    if not isinstance(value, list) or not all(isinstance(sequence, str) for sequence in value):
        raise ValueError('Stop sequences must be a string or a list of strings')
    return [sequence.encode('raw_unicode_escape').decode('unicode_escape') for sequence in value]

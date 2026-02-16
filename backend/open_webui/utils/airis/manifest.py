from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException, status

DEFAULT_MANIFEST_FETCH_TIMEOUT_SECONDS = 10.0

log = logging.getLogger(__name__)


async def fetch_external_manifest(url: str) -> dict[str, object]:
    """Fetch an external web manifest with async I/O and guarded error mapping."""
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_MANIFEST_FETCH_TIMEOUT_SECONDS) as client:
            response = await client.get(url)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as error:
        log.warning("External manifest returned non-success status: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch external manifest",
        ) from error
    except (httpx.RequestError, ValueError) as error:
        log.warning("External manifest request failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch external manifest",
        ) from error

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External manifest payload is invalid",
        )

    return payload

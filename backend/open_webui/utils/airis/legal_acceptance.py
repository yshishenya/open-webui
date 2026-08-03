from __future__ import annotations

import time
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from open_webui.models.legal import LegalAcceptances, LegalDocumentAcceptanceModel
from open_webui.models.users import Users
from open_webui.utils.airis.legal_docs import get_legal_doc


def get_request_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None
    if request.client:
        return request.client.host
    return None


async def record_legal_acceptances(
    *,
    user_id: str,
    keys: list[str],
    request: Request,
    method: str,
    db: AsyncSession | None = None,
) -> list[LegalDocumentAcceptanceModel]:
    requested_keys = list(dict.fromkeys(keys))
    now = int(time.time())

    ip = get_request_ip(request)
    user_agent = request.headers.get("user-agent")

    accepted: list[LegalDocumentAcceptanceModel] = []
    user_updates: dict[str, object] = {}

    for key in requested_keys:
        doc = get_legal_doc(key)
        if not doc:
            continue

        accepted.append(
            await LegalAcceptances.insert_acceptance(
                user_id=user_id,
                doc_key=doc.key,
                doc_version=doc.version,
                accepted_at=now,
                ip=ip,
                user_agent=user_agent,
                method=method,
                db=db,
            )
        )

        if doc.key == "terms_offer":
            user_updates["terms_accepted_at"] = now
        if doc.key == "privacy_policy":
            user_updates["privacy_accepted_at"] = now

    if user_updates:
        await Users.update_user_by_id(user_id, user_updates, db=db)

    return accepted

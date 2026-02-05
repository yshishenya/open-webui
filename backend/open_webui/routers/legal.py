from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from open_webui.models.legal import LegalAcceptances, LegalDocumentAcceptanceModel
from open_webui.models.users import Users, UserModel
from open_webui.utils.airis.legal_acceptance import record_legal_acceptances
from open_webui.utils.airis.legal_docs import LEGAL_DOCS, get_legal_doc, required_legal_docs
from open_webui.utils.auth import get_current_user

router = APIRouter()


class LegalDocResponse(BaseModel):
    key: str
    title: str
    url: str
    version: str
    required: bool = True


class LegalDocStatusResponse(LegalDocResponse):
    accepted_at: Optional[int] = None
    accepted_version: Optional[str] = None


class LegalRequirementsResponse(BaseModel):
    docs: list[LegalDocResponse]
    server_time: int


class LegalStatusResponse(BaseModel):
    docs: list[LegalDocStatusResponse]
    needs_accept: bool
    server_time: int


class AcceptLegalDocsForm(BaseModel):
    keys: list[str] = Field(default_factory=list, description="Legal doc keys to accept")
    method: Optional[str] = Field(
        default="ui",
        description="Acceptance method (e.g. signup, ui_gate, oauth_complete)",
    )


class AcceptLegalDocsResponse(BaseModel):
    accepted: list[LegalDocumentAcceptanceModel]
    status: LegalStatusResponse


def _build_status_for_user(user: UserModel) -> LegalStatusResponse:
    docs: list[LegalDocStatusResponse] = []
    needs_accept = False

    for doc in LEGAL_DOCS:
        latest = LegalAcceptances.get_latest_acceptance(user.id, doc.key)
        accepted_at = latest.accepted_at if latest else None
        accepted_version = latest.doc_version if latest else None

        docs.append(
            LegalDocStatusResponse(
                key=doc.key,
                title=doc.title,
                url=doc.url,
                version=doc.version,
                required=doc.required,
                accepted_at=accepted_at,
                accepted_version=accepted_version,
            )
        )

        if doc.required and accepted_version != doc.version:
            needs_accept = True

    return LegalStatusResponse(docs=docs, needs_accept=needs_accept, server_time=int(time.time()))


@router.get("/requirements", response_model=LegalRequirementsResponse)
async def get_legal_requirements() -> LegalRequirementsResponse:
    return LegalRequirementsResponse(
        docs=[
            LegalDocResponse(
                key=doc.key,
                title=doc.title,
                url=doc.url,
                version=doc.version,
                required=doc.required,
            )
            for doc in required_legal_docs()
        ],
        server_time=int(time.time()),
    )


@router.get("/status", response_model=LegalStatusResponse)
async def get_legal_status(user=Depends(get_current_user)) -> LegalStatusResponse:
    return _build_status_for_user(user)


@router.post("/accept", response_model=AcceptLegalDocsResponse)
async def accept_legal_docs(
    request: Request,
    form_data: AcceptLegalDocsForm,
    user=Depends(get_current_user),
) -> AcceptLegalDocsResponse:
    requested_keys = list(dict.fromkeys(form_data.keys))
    if not requested_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No document keys provided",
        )

    unknown = [key for key in requested_keys if get_legal_doc(key) is None]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown document keys: {', '.join(unknown)}",
        )

    accepted = record_legal_acceptances(
        user_id=user.id,
        keys=requested_keys,
        request=request,
        method=form_data.method or "ui",
    )

    refreshed_user = Users.get_user_by_id(user.id) or user
    return AcceptLegalDocsResponse(
        accepted=accepted,
        status=_build_status_for_user(refreshed_user),
    )

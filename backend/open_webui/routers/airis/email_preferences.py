"""Explicit account choice and passive/public unsubscribe endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from open_webui.models.email_preferences import (
    ProductEmailPreference,
    get_product_preference,
    set_product_preference,
    suppress_product_address,
    unsubscribe_product_email,
)
from open_webui.models.users import UserModel
from open_webui.utils.auth import get_admin_user, get_current_user
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool

router = APIRouter()


class PreferenceForm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    subscribed: StrictBool


class UnsubscribeForm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(min_length=32, max_length=128)


class SuppressionForm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: EmailStr
    reason: Literal['hard_bounce', 'complaint']


def no_store(response: Response) -> None:
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'


@router.get('', response_model=ProductEmailPreference)
async def get_preference(response: Response, user: UserModel = Depends(get_current_user)) -> ProductEmailPreference:
    no_store(response)
    return await get_product_preference(user.id)


@router.post('', response_model=ProductEmailPreference)
async def save_preference(
    form: PreferenceForm, response: Response, user: UserModel = Depends(get_current_user)
) -> ProductEmailPreference:
    no_store(response)
    return await set_product_preference(user.id, form.subscribed, 'settings')


@router.post('/unsubscribe')
async def unsubscribe(form: UnsubscribeForm, response: Response) -> dict[str, bool]:
    no_store(response)
    await unsubscribe_product_email(form.token)
    return {'success': True}


@router.get('/one-click/{token}')
async def passive_one_click(token: str, response: Response) -> dict[str, bool]:
    no_store(response)
    return {'success': True}


@router.post('/one-click/{token}')
async def one_click(token: str, request: Request, response: Response) -> dict[str, bool]:
    no_store(response)
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/x-www-form-urlencoded':
        raise HTTPException(415, 'Unsupported media type')
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 512:
            raise HTTPException(413, 'Request too large')
    if body != b'List-Unsubscribe=One-Click':
        raise HTTPException(400, 'Invalid one-click request')
    await unsubscribe_product_email(token)
    return {'success': True}


@router.post('/suppression')
async def suppress_address(
    form: SuppressionForm, response: Response, admin: UserModel = Depends(get_admin_user)
) -> dict[str, bool]:
    no_store(response)
    await suppress_product_address(str(form.email), form.reason)
    return {'success': True}

"""MFA policy changes must invalidate browser sessions without authorizing challenges."""

from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from open_webui.models.auths import AuthModel, MfaData
from open_webui.utils import auth, mfa


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('claims', 'factor', 'valid'),
    [
        ({'typ': 'session'}, MfaData(secret='encrypted'), False),
        ({'typ': 'session', 'mfa_verified': True}, None, False),
        ({'typ': 'session', 'mfa_verified': True}, MfaData(secret='encrypted', reset_required=True), False),
        ({'typ': 'session', 'mfa_verified': True}, MfaData(secret='encrypted'), True),
        ({'typ': 'enroll', 'mfa_verified': True}, MfaData(secret='encrypted'), False),
        ({'typ': 'automation'}, None, True),
        ({'typ': 'subagent'}, None, True),
        ({'typ': 'automation', 'session_stamp': 'revoked'}, None, False),
        ({'typ': 'session', 'mfa_verified': True, 'session_stamp': 'revoked'}, MfaData(secret='encrypted'), False),
    ],
)
async def test_mfa_session_token_validation(
    monkeypatch: pytest.MonkeyPatch, claims: dict[str, str | bool], factor: MfaData | None, valid: bool
) -> None:
    credential = AuthModel(id='user', email='user@example.com', password='hash', session_stamp='current', mfa=factor)
    monkeypatch.setattr(mfa, 'get_auth', AsyncMock(return_value=credential))
    monkeypatch.setattr(mfa, 'get_mfa_config', AsyncMock(return_value=mfa.MfaConfigForm(ENABLE_MFA=True)))
    token = {'id': 'user', 'session_stamp': 'current', 'auth_method': 'password', **claims}
    assert await auth.is_valid_token(token) is valid


@pytest.mark.asyncio
@pytest.mark.parametrize('error_status', [401, 503])
async def test_credential_failure_cannot_fall_back_to_redis_acceptance(
    monkeypatch: pytest.MonkeyPatch, error_status: int
) -> None:
    monkeypatch.setattr(mfa, 'get_auth', AsyncMock(side_effect=HTTPException(error_status, 'Unavailable')))
    redis = AsyncMock()
    with pytest.raises(HTTPException) as error:
        await auth.is_valid_token({'id': 'disabled', 'session_stamp': 'current'}, redis)
    assert error.value.status_code == error_status
    redis.get.assert_not_awaited()

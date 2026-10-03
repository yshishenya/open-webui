from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException
from open_webui.models.models import ModelMeta, ModelModel, ModelParams
from open_webui.utils.airis.image_access import can_use_configured_image_model, check_image_model_access


def _model(model_id: str = 'image', *, active: bool = True, base: str | None = None) -> ModelModel:
    return ModelModel(
        id=model_id,
        user_id='owner',
        name=model_id,
        is_active=active,
        base_model_id=base,
        meta=ModelMeta(),
        params=ModelParams(),
        created_at=1,
        updated_at=1,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize('role', ['user', 'admin', 'pending'])
async def test_disabled_base_is_forbidden_for_every_role(monkeypatch: MonkeyPatch, role: str) -> None:
    import open_webui.utils.airis.image_access as access

    models = {'image': _model(base='base'), 'base': _model('base', active=False)}
    getter = AsyncMock(side_effect=lambda model_id: models.get(model_id))
    grant_check = AsyncMock()
    monkeypatch.setattr(access.Models, 'get_model_by_id', getter)
    monkeypatch.setattr(access, 'check_model_access', grant_check)
    with pytest.raises(HTTPException) as exc:
        await check_image_model_access(SimpleNamespace(id='caller', role=role), 'image')
    assert exc.value.status_code == 403
    assert exc.value.detail['error'] == 'model_disabled'
    grant_check.assert_not_awaited()


@pytest.mark.asyncio
async def test_cyclic_image_base_is_rejected(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.airis.image_access as access

    monkeypatch.setattr(access.Models, 'get_model_by_id', AsyncMock(return_value=_model(base='image')))
    with pytest.raises(HTTPException, match='Model not found'):
        await check_image_model_access(SimpleNamespace(id='caller', role='admin'), 'image')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('engine', 'model_id', 'expected'),
    [
        ('openai', '', 'dall-e-2'),
        ('gemini', '', 'imagen-3.0-generate-002'),
        ('comfyui', 'image', 'image'),
        ('openai', 'configured', 'configured'),
    ],
)
async def test_config_defaults_match_image_engine(
    monkeypatch: MonkeyPatch, engine: str, model_id: str, expected: str
) -> None:
    import open_webui.utils.airis.image_access as access

    guard = AsyncMock()
    monkeypatch.setattr(access, 'check_image_model_access', guard)
    user = SimpleNamespace(id='caller', role='user')
    assert await can_use_configured_image_model(user, enabled=True, engine=engine, model_id=model_id)
    guard.assert_awaited_once_with(user, expected)


@pytest.mark.asyncio
async def test_config_does_not_swallow_internal_failure(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.airis.image_access as access

    monkeypatch.setattr(access, 'check_image_model_access', AsyncMock(side_effect=RuntimeError('database error')))
    with pytest.raises(RuntimeError, match='database error'):
        await can_use_configured_image_model(
            SimpleNamespace(id='caller', role='user'), enabled=True, engine='openai', model_id='image'
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('enabled', 'engine', 'expected'), [(False, 'openai', False), (True, 'automatic1111', True), (True, '', True)]
)
async def test_config_disabled_or_dynamic_checkpoint_needs_no_model_lookup(
    monkeypatch: MonkeyPatch, enabled: bool, engine: str, expected: bool
) -> None:
    import open_webui.utils.airis.image_access as access

    getter = AsyncMock(side_effect=AssertionError('config must not discover provider models'))
    monkeypatch.setattr(access.Models, 'get_model_by_id', getter)
    assert (
        await can_use_configured_image_model(
            SimpleNamespace(id='caller', role='user'), enabled=enabled, engine=engine, model_id=''
        )
        is expected
    )
    getter.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_user_is_denied_before_lookup(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.airis.image_access as access

    getter = AsyncMock(side_effect=AssertionError('lookup must not run'))
    monkeypatch.setattr(access.Models, 'get_model_by_id', getter)
    with pytest.raises(HTTPException) as exc:
        await check_image_model_access(None, 'image')
    assert exc.value.status_code == 401
    getter.assert_not_awaited()

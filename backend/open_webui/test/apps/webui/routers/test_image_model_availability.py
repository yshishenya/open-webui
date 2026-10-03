from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException
from open_webui.models.config import Config
from open_webui.models.models import ModelForm, ModelMeta, ModelParams, Models
from open_webui.models.users import Users
from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestImageModelAvailability(AbstractPostgresTest):
    BASE_PATH = '/api/v1/images'

    def setup_method(self) -> None:
        super().setup_method()
        asyncio.run(
            Config.upsert(
                {
                    'image_generation.enable': True,
                    'image_generation.engine': 'openai',
                    'image_generation.model': 'image-test',
                    'image_generation.size': '1024x1024',
                    'images.edit.enable': True,
                    'images.edit.engine': 'openai',
                    'images.edit.model': 'image-test',
                    'images.edit.size': '1024x1024',
                    'user.permissions': {'features': {'image_generation': True}},
                }
            )
        )

    def _model(self, *, active: bool, public: bool = True, owner: str = 'owner', hidden: bool = False) -> None:
        model = asyncio.run(
            Models.insert_new_model(
                ModelForm(
                    id='image-test',
                    name='Image test',
                    meta=ModelMeta(hidden=hidden),
                    params=ModelParams(),
                    is_active=active,
                    access_grants=(
                        [{'principal_type': 'user', 'principal_id': '*', 'permission': 'read'}] if public else []
                    ),
                ),
                user_id=owner,
            )
        )
        assert model is not None

    @pytest.mark.parametrize('operation', ['generate', 'edit'])
    @pytest.mark.parametrize('entry', ['route', 'shared'])
    @pytest.mark.parametrize('case', ['disabled', 'private', 'missing'])
    def test_denied_before_image_loading_and_billing(
        self, monkeypatch: MonkeyPatch, operation: str, entry: str, case: str
    ) -> None:
        import open_webui.routers.images as images

        if case != 'missing':
            self._model(active=case != 'disabled', public=case != 'private')
        billing = AsyncMock(side_effect=HTTPException(418, 'billing must not run'))
        loader = AsyncMock(side_effect=HTTPException(418, 'image must not load'))
        provider = AsyncMock(side_effect=AssertionError('provider must not run'))
        monkeypatch.setattr(images, 'preflight_image_billing', billing)
        monkeypatch.setattr(images, 'get_file_content_by_id', loader)
        monkeypatch.setattr(images, 'get_session', provider)
        with mock_webui_user(id='caller'):
            if entry == 'route':
                payload = {'prompt': 'test'}
                if operation == 'edit':
                    payload['image'] = 'input-file'
                response = self.fast_api_client.post(
                    self.create_url('/generations' if operation == 'generate' else '/edit'), json=payload
                )
                code, detail = response.status_code, response.json()['detail']
            else:
                user = asyncio.run(Users.get_user_by_id('caller'))
                assert user is not None
                call = (
                    images.image_generations(SimpleNamespace(), images.CreateImageForm(prompt='test'), user=user)
                    if operation == 'generate'
                    else images.image_edits(
                        SimpleNamespace(), images.EditImageForm(prompt='test', image='input-file'), user=user
                    )
                )
                with pytest.raises(HTTPException) as exc:
                    asyncio.run(call)
                code, detail = exc.value.status_code, exc.value.detail
        assert code == 403
        if case == 'disabled':
            assert detail['error'] == 'model_disabled'
        else:
            assert detail == 'Model not found'
        billing.assert_not_awaited()
        loader.assert_not_awaited()
        provider.assert_not_awaited()

    @pytest.mark.parametrize('case', ['disabled', 'private', 'missing'])
    def test_authenticated_feature_hides_unavailable_model(self, case: str) -> None:
        if case != 'missing':
            self._model(active=case != 'disabled', public=case != 'private')
        with mock_webui_user(id='caller') as token:
            response = self.fast_api_client.get('/api/config', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        assert response.json()['features']['enable_image_generation'] is False

    @pytest.mark.parametrize(
        ('case', 'role', 'caller', 'expected'),
        [
            ('public', 'user', 'caller', 418),
            ('hidden', 'user', 'caller', 418),
            ('private', 'user', 'owner', 418),
            ('private', 'admin', 'caller', 418),
            ('missing', 'admin', 'caller', 418),
            ('disabled', 'admin', 'caller', 403),
            ('private', 'pending', 'caller', 403),
        ],
    )
    @pytest.mark.parametrize('operation', ['generate', 'edit'])
    def test_existing_access_contract(
        self, monkeypatch: MonkeyPatch, case: str, role: str, caller: str, expected: int, operation: str
    ) -> None:
        import open_webui.routers.images as images

        if case != 'missing':
            self._model(active=case != 'disabled', public=case not in {'private', 'disabled'}, hidden=case == 'hidden')
        billing = AsyncMock(side_effect=HTTPException(418, 'authorized preflight reached'))
        monkeypatch.setattr(images, 'preflight_image_billing', billing)
        with mock_webui_user(id=caller, role=role):
            user = asyncio.run(Users.get_user_by_id(caller))
            assert user is not None
            call = (
                images.image_generations(SimpleNamespace(), images.CreateImageForm(prompt='test'), user=user)
                if operation == 'generate'
                else images.image_edits(
                    SimpleNamespace(),
                    images.EditImageForm(prompt='test', image='data:image/png;base64,aQ=='),
                    user=user,
                )
            )
            with pytest.raises(HTTPException) as exc:
                asyncio.run(call)
        assert exc.value.status_code == expected
        if expected == 418:
            billing.assert_awaited_once()
        else:
            billing.assert_not_awaited()

    def test_group_read_grant_allows_images(self, monkeypatch: MonkeyPatch) -> None:
        import open_webui.routers.images as images
        from open_webui.models.access_grants import AccessGrants
        from open_webui.models.groups import GroupForm, Groups

        self._model(active=True, public=False)

        async def create_group_grant() -> None:
            group = await Groups.insert_new_group('owner', GroupForm(name='Image users', description='Test'))
            assert group is not None
            await Groups.add_users_to_group(group.id, ['caller'])
            await AccessGrants.set_access_grants(
                'model', 'image-test', [{'principal_type': 'group', 'principal_id': group.id, 'permission': 'read'}]
            )

        with mock_webui_user(id='caller'):
            asyncio.run(create_group_grant())
            monkeypatch.setattr(
                images, 'preflight_image_billing', AsyncMock(side_effect=HTTPException(418, 'authorized'))
            )
            response = self.fast_api_client.post(self.create_url('/generations'), json={'prompt': 'test'})
        assert response.status_code == 418

    @pytest.mark.parametrize(('public', 'caller'), [(True, 'caller'), (False, 'owner')])
    def test_authenticated_feature_retains_accessible_models(self, public: bool, caller: str) -> None:
        self._model(active=True, public=public)
        with mock_webui_user(id=caller) as token:
            response = self.fast_api_client.get('/api/config', headers={'Authorization': f'Bearer {token}'})
        assert response.status_code == 200
        assert response.json()['features']['enable_image_generation'] is True

    @pytest.mark.parametrize('case', ['disabled', 'private', 'missing'])
    def test_edit_override_cannot_bypass_access(self, monkeypatch: MonkeyPatch, case: str) -> None:
        import open_webui.routers.images as images

        self._model(active=True)
        if case != 'missing':
            model = asyncio.run(
                Models.insert_new_model(
                    ModelForm(
                        id='override-image',
                        name='Override',
                        meta=ModelMeta(),
                        params=ModelParams(),
                        is_active=case != 'disabled',
                        access_grants=[],
                    ),
                    user_id='owner',
                )
            )
            assert model is not None
        loader = AsyncMock(side_effect=AssertionError('input must not load'))
        billing = AsyncMock(side_effect=AssertionError('billing must not run'))
        monkeypatch.setattr(images, 'get_file_content_by_id', loader)
        monkeypatch.setattr(images, 'preflight_image_billing', billing)
        with mock_webui_user(id='caller'):
            response = self.fast_api_client.post(
                self.create_url('/edit'), json={'model': 'override-image', 'prompt': 'test', 'image': 'input-file'}
            )
        assert response.status_code == 403
        loader.assert_not_awaited()
        billing.assert_not_awaited()

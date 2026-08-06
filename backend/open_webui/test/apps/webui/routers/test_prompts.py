import asyncio
from copy import deepcopy

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestPrompts(AbstractPostgresTest):
    BASE_PATH = '/api/v1/prompts'

    def test_prompts(self):
        from open_webui.models.config import Config

        permissions = deepcopy(Config.default_value('user.permissions', {}))
        permissions.setdefault('workspace', {})['prompts'] = True
        permissions.setdefault('sharing', {})['public_prompts'] = True
        asyncio.run(Config.upsert({'user.permissions': permissions}))

        # Get all prompts
        with mock_webui_user(id='2'):
            response = self.fast_api_client.get(self.create_url('/'))
        assert response.status_code == 200
        assert len(response.json()) == 0

        # Create a two new prompts
        with mock_webui_user(id='2'):
            response = self.fast_api_client.post(
                self.create_url('/create'),
                json={
                    'command': '/my-command',
                    'name': 'Hello World',
                    'content': 'description',
                    'access_grants': [
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'read',
                        },
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'write',
                        },
                    ],
                },
            )
        assert response.status_code == 200
        first_prompt_id = response.json()['id']
        with mock_webui_user(id='3'):
            response = self.fast_api_client.post(
                self.create_url('/create'),
                json={
                    'command': '/my-command2',
                    'name': 'Hello World 2',
                    'content': 'description 2',
                    'access_grants': [
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'read',
                        },
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'write',
                        },
                    ],
                },
            )
        assert response.status_code == 200
        second_prompt_id = response.json()['id']

        # Get all prompts
        with mock_webui_user(id='2'):
            response = self.fast_api_client.get(self.create_url('/'))
        assert response.status_code == 200
        assert len(response.json()) == 2

        # Get prompt by command
        with mock_webui_user(id='2'):
            response = self.fast_api_client.get(
                self.create_url(f'/id/{first_prompt_id}')
            )
        assert response.status_code == 200
        data = response.json()
        assert data['command'] == '/my-command'
        assert data['name'] == 'Hello World'
        assert data['content'] == 'description'
        assert data['user_id'] == '2'

        # Update prompt
        with mock_webui_user(id='3'):
            response = self.fast_api_client.post(
                self.create_url(f'/id/{second_prompt_id}/update'),
                json={
                    'command': '/my-command2',
                    'name': 'Hello World Updated',
                    'content': 'description Updated',
                    'access_grants': [
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'read',
                        },
                        {
                            'principal_type': 'user',
                            'principal_id': '*',
                            'permission': 'write',
                        },
                    ],
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data['command'] == '/my-command2'
        assert data['name'] == 'Hello World Updated'
        assert data['content'] == 'description Updated'
        assert data['user_id'] == '3'

        # Get prompt by command
        with mock_webui_user(id='2'):
            response = self.fast_api_client.get(
                self.create_url(f'/id/{second_prompt_id}')
            )
        assert response.status_code == 200
        data = response.json()
        assert data['command'] == '/my-command2'
        assert data['name'] == 'Hello World Updated'
        assert data['content'] == 'description Updated'
        assert data['user_id'] == '3'

        # Delete prompt
        with mock_webui_user(id='2'):
            response = self.fast_api_client.delete(
                self.create_url(f'/id/{first_prompt_id}/delete')
            )
        assert response.status_code == 200

        # Get all prompts
        with mock_webui_user(id='2'):
            response = self.fast_api_client.get(self.create_url('/'))
        assert response.status_code == 200
        assert len(response.json()) == 1

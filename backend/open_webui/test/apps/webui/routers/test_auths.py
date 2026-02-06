import time

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


def _sign_telegram_payload(payload: dict[str, object], bot_token: str) -> dict[str, object]:
    from open_webui.utils.telegram_auth import (
        build_telegram_data_check_string,
        compute_telegram_login_hash,
    )

    data_check_string = build_telegram_data_check_string(payload)
    payload["hash"] = compute_telegram_login_hash(data_check_string, bot_token)
    return payload


class TestAuths(AbstractPostgresTest):
    BASE_PATH = "/api/v1/auths"

    def setup_class(cls):
        super().setup_class()
        from open_webui.models.auths import Auths
        from open_webui.models.users import Users

        cls.users = Users
        cls.auths = Auths

    def test_get_session_user(self):
        with mock_webui_user() as token:
            response = self.fast_api_client.get(
                self.create_url(""),
                headers={"Authorization": f"Bearer {token}"},
            )
        assert response.status_code == 200
        payload = response.json()
        assert payload["id"] == "1"
        assert payload["name"] == "John Doe"
        assert payload["email"] == "john.doe@openwebui.com"
        assert payload["role"] == "user"
        assert payload["profile_image_url"] == "/user.png"

    def test_update_profile(self):
        from open_webui.utils.auth import get_password_hash

        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password=get_password_hash("old_password"),
            name="John Doe",
            profile_image_url="/user.png",
            role="user",
        )

        with mock_webui_user(id=user.id):
            response = self.fast_api_client.post(
                self.create_url("/update/profile"),
                json={"name": "John Doe 2", "profile_image_url": "/user2.png"},
            )
        assert response.status_code == 200
        db_user = self.users.get_user_by_id(user.id)
        assert db_user.name == "John Doe 2"
        assert db_user.profile_image_url == "/user2.png"

    def test_update_password(self):
        from open_webui.utils.auth import get_password_hash

        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password=get_password_hash("old_password"),
            name="John Doe",
            profile_image_url="/user.png",
            role="user",
        )

        with mock_webui_user(id=user.id):
            response = self.fast_api_client.post(
                self.create_url("/update/password"),
                json={"password": "old_password", "new_password": "new_password"},
            )
        assert response.status_code == 200

        from open_webui.utils.auth import verify_password

        old_auth = self.auths.authenticate_user(
            "john.doe@openwebui.com",
            lambda pw: verify_password("old_password", pw),
        )
        assert old_auth is None
        new_auth = self.auths.authenticate_user(
            "john.doe@openwebui.com",
            lambda pw: verify_password("new_password", pw),
        )
        assert new_auth is not None

    def test_signin(self):
        from open_webui.utils.auth import get_password_hash

        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password=get_password_hash("password"),
            name="John Doe",
            profile_image_url="/user.png",
            role="user",
        )
        response = self.fast_api_client.post(
            self.create_url("/signin"),
            json={"email": "john.doe@openwebui.com", "password": "password"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user.id
        assert data["name"] == "John Doe"
        assert data["email"] == "john.doe@openwebui.com"
        assert data["role"] == "user"
        assert data["profile_image_url"] == "/user.png"
        assert data["token"] is not None and len(data["token"]) > 0
        assert data["token_type"] == "Bearer"

    def test_signup(self):
        response = self.fast_api_client.post(
            self.create_url("/signup"),
            json={
                "name": "John Doe",
                "email": "john.doe@openwebui.com",
                "password": "password",
                "terms_accepted": True,
                "privacy_accepted": True,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None and len(data["id"]) > 0
        assert data["name"] == "John Doe"
        assert data["email"] == "john.doe@openwebui.com"
        assert data["role"] in ["admin", "user", "pending"]
        assert data["profile_image_url"] == "/user.png"
        assert data["token"] is not None and len(data["token"]) > 0
        assert data["token_type"] == "Bearer"

        db_user = self.users.get_user_by_id(data["id"])
        assert db_user is not None
        assert db_user.terms_accepted_at is not None
        assert db_user.privacy_accepted_at is not None

        status_response = self.fast_api_client.get(
            "/api/v1/legal/status",
            headers={"Authorization": f"Bearer {data['token']}"},
        )
        assert status_response.status_code == 200
        assert status_response.json()["needs_accept"] is False

    def test_add_user(self):
        with mock_webui_user():
            response = self.fast_api_client.post(
                self.create_url("/add"),
                json={
                    "name": "John Doe 2",
                    "email": "john.doe2@openwebui.com",
                    "password": "password2",
                    "role": "admin",
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None and len(data["id"]) > 0
        assert data["name"] == "John Doe 2"
        assert data["email"] == "john.doe2@openwebui.com"
        assert data["role"] == "admin"
        assert data["profile_image_url"] == "/user.png"
        assert data["token"] is not None and len(data["token"]) > 0
        assert data["token_type"] == "Bearer"

    def test_get_admin_details(self):
        self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password="password",
            name="John Doe",
            profile_image_url="/user.png",
            role="admin",
        )
        with mock_webui_user():
            response = self.fast_api_client.get(self.create_url("/admin/details"))

        assert response.status_code == 200
        assert response.json() == {
            "name": "John Doe",
            "email": "john.doe@openwebui.com",
        }

    def test_create_api_key_(self):
        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password="password",
            name="John Doe",
            profile_image_url="/user.png",
            role="admin",
        )
        config = self.fast_api_client.app.state.config
        config.ENABLE_API_KEYS = True
        config.USER_PERMISSIONS["features"]["api_keys"] = True
        with mock_webui_user(id=user.id):
            response = self.fast_api_client.post(self.create_url("/api_key"))
        assert response.status_code == 200
        data = response.json()
        assert data["api_key"] is not None
        assert len(data["api_key"]) > 0

    def test_delete_api_key(self):
        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password="password",
            name="John Doe",
            profile_image_url="/user.png",
            role="admin",
        )
        config = self.fast_api_client.app.state.config
        config.ENABLE_API_KEYS = True
        config.USER_PERMISSIONS["features"]["api_keys"] = True
        self.users.update_user_api_key_by_id(user.id, "abc")
        with mock_webui_user(id=user.id):
            response = self.fast_api_client.delete(self.create_url("/api_key"))
        assert response.status_code == 200
        assert response.json()
        api_key = self.users.get_user_api_key_by_id(user.id)
        assert api_key is None

    def test_get_api_key(self):
        user = self.auths.insert_new_auth(
            email="john.doe@openwebui.com",
            password="password",
            name="John Doe",
            profile_image_url="/user.png",
            role="admin",
        )
        self.users.update_user_api_key_by_id(user.id, "abc")
        with mock_webui_user(id=user.id):
            response = self.fast_api_client.get(self.create_url("/api_key"))
        assert response.status_code == 200
        assert response.json() == {"api_key": "abc"}

    def test_telegram_signup_requires_legal_acceptance(self):
        bot_token = "123:TEST_BOT_TOKEN"
        config = self.fast_api_client.app.state.config
        config.ENABLE_TELEGRAM_AUTH = True
        config.ENABLE_TELEGRAM_SIGNUP = True
        config.TELEGRAM_BOT_TOKEN = bot_token

        state_response = self.fast_api_client.get(self.create_url("/telegram/state"))
        assert state_response.status_code == 200
        state = state_response.json()["state"]

        payload: dict[str, object] = _sign_telegram_payload(
            {
                "id": 777,
                "first_name": "Jane",
                "auth_date": int(time.time()),
            },
            bot_token,
        )

        response = self.fast_api_client.post(
            self.create_url("/telegram/signup"),
            json={"state": state, "payload": payload},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "You must accept the terms and privacy policy"

        assert self.users.get_user_by_email("telegram@777.local") is None

    def test_telegram_signup_records_legal_acceptance(self):
        bot_token = "123:TEST_BOT_TOKEN"
        config = self.fast_api_client.app.state.config
        config.ENABLE_TELEGRAM_AUTH = True
        config.ENABLE_TELEGRAM_SIGNUP = True
        config.TELEGRAM_BOT_TOKEN = bot_token

        state_response = self.fast_api_client.get(self.create_url("/telegram/state"))
        assert state_response.status_code == 200
        state = state_response.json()["state"]

        payload: dict[str, object] = _sign_telegram_payload(
            {
                "id": 888,
                "first_name": "Jane",
                "auth_date": int(time.time()),
            },
            bot_token,
        )

        response = self.fast_api_client.post(
            self.create_url("/telegram/signup"),
            json={
                "state": state,
                "payload": payload,
                "terms_accepted": True,
                "privacy_accepted": True,
            },
        )
        assert response.status_code == 200

        data = response.json()
        assert data["id"] is not None and len(data["id"]) > 0
        assert data["email"] == "telegram@888.local"
        assert data["token"] is not None and len(data["token"]) > 0

        db_user = self.users.get_user_by_id(data["id"])
        assert db_user is not None
        assert db_user.terms_accepted_at is not None
        assert db_user.privacy_accepted_at is not None
        assert db_user.oauth is not None
        assert db_user.oauth.get("telegram", {}).get("sub") == "888"

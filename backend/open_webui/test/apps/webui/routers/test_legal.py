# ruff: noqa: Q000

from test.util.abstract_integration_test import AbstractPostgresTest
from test.util.mock_user import mock_webui_user


class TestLegal(AbstractPostgresTest):
    BASE_PATH = "/api/v1/legal"

    def test_status_requires_accept_when_missing(self):
        with mock_webui_user() as token:
            response = self.fast_api_client.get(
                self.create_url("/status"),
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["needs_accept"] is True

        required_keys = {doc["key"] for doc in payload["docs"] if doc["required"]}
        assert required_keys == {
            "terms_offer",
            "privacy_policy",
            "personal_data_consent",
        }
        versions = {doc["key"]: doc["version"] for doc in payload["docs"]}
        assert versions == {
            "terms_offer": "2026-02-05",
            "privacy_policy": "2026-08-23",
            "personal_data_consent": "2026-08-23",
        }

    def test_accept_required_docs(self):
        with mock_webui_user() as token:
            response = self.fast_api_client.post(
                self.create_url("/accept"),
                json={
                    "keys": [
                        "terms_offer",
                        "privacy_policy",
                        "personal_data_consent",
                    ],
                    "method": "test",
                },
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload["accepted"]) == 3
        assert payload["status"]["needs_accept"] is False

    def test_accept_rejects_unknown_keys(self):
        with mock_webui_user() as token:
            response = self.fast_api_client.post(
                self.create_url("/accept"),
                json={"keys": ["unknown_doc_key"]},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 400

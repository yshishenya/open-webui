import json
import time

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi import HTTPException
from starlette.requests import Request


def _build_request(body: bytes) -> Request:
    async def _receive() -> dict[str, object]:
        return {
            "type": "http.request",
            "body": body,
            "more_body": False,
        }

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/billing/webhook/yookassa",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope, _receive)


def _build_webhook_payload(payment_id: str = "pay_direct_1") -> bytes:
    payload = {
        "event": "payment.succeeded",
        "object": {
            "id": payment_id,
            "status": "succeeded",
            "amount": {"value": "100.00", "currency": "RUB"},
            "metadata": {
                "transaction_id": f"tx_{payment_id}",
                "user_id": "user_1",
                "plan_id": "plan_1",
            },
        },
    }
    return json.dumps(payload).encode("utf-8")


class _FakeYookassaClient:
    def __init__(self, webhook_secret: str | None, verify_result: bool = True) -> None:
        self.config = type("Config", (), {"webhook_secret": webhook_secret})()
        self._verify_result = verify_result

    def verify_webhook(self, _body: str, _signature: str) -> bool:
        return self._verify_result


@pytest.mark.asyncio
async def test_yookassa_webhook_direct_success_path(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    captured: dict[str, object] = {}

    async def _process_webhook(parsed_data: dict[str, object]) -> None:
        captured["parsed_data"] = parsed_data

    monkeypatch.setattr(
        billing_router.billing_service,
        "process_payment_webhook",
        _process_webhook,
    )
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)

    request = _build_request(_build_webhook_payload())
    response = await billing_router.yookassa_webhook(
        request,
        x_yookassa_signature=None,
        x_yookassa_timestamp=None,
        token=None,
    )

    assert response.status_code == 200
    assert captured["parsed_data"]["event_type"] == "payment.succeeded"
    assert captured["parsed_data"]["payment_id"] == "pay_direct_1"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_invalid_token(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "secret-token")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid webhook token"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_non_utf8_body(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(b"\xff\xfe"),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid request body encoding"


@pytest.mark.asyncio
async def test_yookassa_webhook_does_not_require_signature_when_secret_is_configured_but_enforcement_disabled(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.routers.billing as billing_router

    captured: dict[str, object] = {}

    async def _process_webhook(parsed_data: dict[str, object]) -> None:
        captured["parsed_data"] = parsed_data

    monkeypatch.setattr(
        billing_router.billing_service,
        "process_payment_webhook",
        _process_webhook,
    )
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", False)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret"),
    )
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)

    response = await billing_router.yookassa_webhook(
        _build_request(_build_webhook_payload()),
        x_yookassa_signature=None,
        x_yookassa_timestamp=None,
        token=None,
    )

    assert response.status_code == 200
    assert captured["parsed_data"]["event_type"] == "payment.succeeded"
    assert captured["parsed_data"]["payment_id"] == "pay_direct_1"


@pytest.mark.asyncio
async def test_yookassa_webhook_requires_signature_when_enforced(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Missing signature"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_enforced_signature_without_secret(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature="sig",
            x_yookassa_timestamp=str(int(time.time())),
            token=None,
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Payment system temporarily unavailable"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_invalid_signature_timestamp(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature="sig",
            x_yookassa_timestamp="not-an-int",
            token=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid signature timestamp"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_outdated_signature_timestamp(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret"),
    )

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature="sig",
            x_yookassa_timestamp=str(int(time.time()) - 301),
            token=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Signature timestamp is outside allowed window"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_invalid_signature(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret", verify_result=False),
    )

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload()),
            x_yookassa_signature="sig",
            x_yookassa_timestamp=str(int(time.time())),
            token=None,
        )

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid signature"


@pytest.mark.asyncio
async def test_yookassa_webhook_direct_success_path_with_enforced_signature(
    monkeypatch: MonkeyPatch,
) -> None:
    import open_webui.routers.billing as billing_router

    captured: dict[str, object] = {}

    async def _process_webhook(parsed_data: dict[str, object]) -> None:
        captured["parsed_data"] = parsed_data

    monkeypatch.setattr(
        billing_router.billing_service,
        "process_payment_webhook",
        _process_webhook,
    )
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_SIGNATURE", True)
    monkeypatch.setattr(
        billing_router,
        "get_yookassa_client",
        lambda: _FakeYookassaClient(webhook_secret="configured-secret", verify_result=True),
    )
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)

    response = await billing_router.yookassa_webhook(
        _build_request(_build_webhook_payload()),
        x_yookassa_signature="sig",
        x_yookassa_timestamp=str(int(time.time())),
        token=None,
    )

    assert response.status_code == 200
    assert captured["parsed_data"]["event_type"] == "payment.succeeded"
    assert captured["parsed_data"]["payment_id"] == "pay_direct_1"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_invalid_json(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(b"not-json"),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid JSON payload"


@pytest.mark.asyncio
async def test_yookassa_webhook_returns_ok_for_replayed_event(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: True)

    response = await billing_router.yookassa_webhook(
        _build_request(_build_webhook_payload("pay_replay")),
        x_yookassa_signature=None,
        x_yookassa_timestamp=None,
        token=None,
    )

    assert response.status_code == 200
    assert json.loads(response.body) == {"status": "ok", "replayed": True}


@pytest.mark.asyncio
async def test_yookassa_webhook_maps_verification_error(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    async def _raise_verification_error(_: dict[str, object]) -> None:
        raise billing_router.WebhookVerificationError("bad webhook")

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)
    monkeypatch.setattr(billing_router.billing_service, "process_payment_webhook", _raise_verification_error)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload("pay_verification_error")),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Webhook verification failed"


@pytest.mark.asyncio
async def test_yookassa_webhook_maps_retryable_error(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    async def _raise_retryable_error(_: dict[str, object]) -> None:
        raise billing_router.WebhookRetryableError("retry later")

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)
    monkeypatch.setattr(billing_router.billing_service, "process_payment_webhook", _raise_retryable_error)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload("pay_retryable_error")),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail == "Temporary error processing webhook"


@pytest.mark.asyncio
async def test_yookassa_webhook_rejects_invalid_parsed_payload(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(
        billing_router.YooKassaWebhookHandler,
        "parse_webhook",
        lambda _payload: (_ for _ in ()).throw(ValueError("invalid payload")),
    )

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload("pay_bad_payload")),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid webhook payload"


@pytest.mark.asyncio
async def test_yookassa_webhook_maps_unexpected_processing_error(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    async def _raise_unexpected_error(_: dict[str, object]) -> None:
        raise RuntimeError("unexpected")

    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_TOKEN", "")
    monkeypatch.setattr(billing_router, "YOOKASSA_WEBHOOK_ENFORCE_IP_ALLOWLIST", False)
    monkeypatch.setattr(billing_router, "get_yookassa_client", lambda: None)
    monkeypatch.setattr(billing_router, "_is_webhook_replay", lambda *_: False)
    monkeypatch.setattr(billing_router.billing_service, "process_payment_webhook", _raise_unexpected_error)

    with pytest.raises(HTTPException) as exc_info:
        await billing_router.yookassa_webhook(
            _build_request(_build_webhook_payload("pay_unexpected_error")),
            x_yookassa_signature=None,
            x_yookassa_timestamp=None,
            token=None,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "Failed to process webhook"

import pytest

from _pytest.monkeypatch import MonkeyPatch
from types import SimpleNamespace

from open_webui.models.billing import PaymentStatus, TransactionStatus
from open_webui.utils.yookassa import YooKassaRequestError


def test_sanitize_payment_return_url_rejects_unsafe_values() -> None:
    import open_webui.routers.billing as billing_router

    invalid_urls = [
        "",
        "   ",
        "javascript:alert(1)",
        "https://user:pass@example.com/path",
        "https://example.com/path#fragment",
        "http:///example.com",
        "ftp://example.com",
        "not-a-url",
    ]

    for return_url in invalid_urls:
        with pytest.raises(ValueError, match="Invalid return_url"):
            billing_router._sanitize_payment_return_url(return_url)


def test_sanitize_payment_return_url_normalizes_path_and_query() -> None:
    import open_webui.routers.billing as billing_router

    assert (
        billing_router._sanitize_payment_return_url("https://example.com/path?x=1")
        == "https://example.com/path?x=1"
    )
    assert (
        billing_router._sanitize_payment_return_url("https://example.com/")
        == "https://example.com/"
    )
    assert (
        billing_router._sanitize_payment_return_url("https://example.com")
        == "https://example.com/"
    )


def test_payment_gateway_http_error_maps_provider_error_codes() -> None:
    import open_webui.routers.billing as billing_router

    cases = [
        (
            401,
            None,
            False,
            502,
            "Payment provider credentials are invalid",
        ),
        (
            403,
            None,
            False,
            502,
            "Payment provider credentials are invalid",
        ),
        (400, None, False, 502, "Payment provider rejected the payment request"),
        (429, None, True, 503, "Payment provider is rate-limiting requests"),
        (500, None, True, 503, "Payment provider is temporarily unavailable"),
    ]

    for status_code, error_code, retryable, expected_status, expected_detail in cases:
        error = YooKassaRequestError(
            f"status {status_code}",
            status_code=status_code,
            response_text="{}",
            retryable=retryable,
            error_code=error_code,
        )
        http_exc = billing_router._payment_gateway_http_error(error, "topup")
        assert http_exc.status_code == expected_status
        assert http_exc.detail == expected_detail


def test_payment_gateway_http_error_uses_invalid_credentials_error_code() -> None:
    import open_webui.routers.billing as billing_router

    error = YooKassaRequestError(
        "invalid credentials",
        status_code=500,
        response_text="{}",
        error_code="invalid_credentials",
        retryable=False,
    )
    http_exc = billing_router._payment_gateway_http_error(error, "payment")
    assert http_exc.status_code == 502
    assert http_exc.detail == "Payment provider credentials are invalid"


def test_is_webhook_replay_detects_existing_payment_state(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(
        billing_router.Payments,
        "get_payment_by_provider_id",
        lambda *_: SimpleNamespace(status=PaymentStatus.SUCCEEDED.value),
    )
    assert billing_router._is_webhook_replay(
        {
            "event_type": "payment.succeeded",
            "payment_id": "pay_1",
        }
    )


def test_is_webhook_replay_detects_successful_transaction_fallback(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(
        billing_router.Payments,
        "get_payment_by_provider_id",
        lambda *_: None,
    )
    monkeypatch.setattr(
        billing_router.billing_service.transactions,
        "get_transaction_by_id",
        lambda *_: SimpleNamespace(status=TransactionStatus.SUCCEEDED.value),
    )

    assert billing_router._is_webhook_replay(
        {
            "event_type": "payment.succeeded",
            "payment_id": "pay_tx",
            "metadata": {"transaction_id": "tx_1"},
        }
    )


def test_is_webhook_replay_does_not_replay_other_statuses(monkeypatch: MonkeyPatch) -> None:
    import open_webui.routers.billing as billing_router

    monkeypatch.setattr(
        billing_router.Payments,
        "get_payment_by_provider_id",
        lambda *_: SimpleNamespace(status=PaymentStatus.PENDING.value),
    )

    assert not billing_router._is_webhook_replay(
        {
            "event_type": "payment.succeeded",
            "payment_id": "pay_1",
            "metadata": {"transaction_id": "tx_1"},
        }
    )

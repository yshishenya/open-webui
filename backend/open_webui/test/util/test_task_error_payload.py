from fastapi import HTTPException, status

from open_webui.utils.airis.task_error_payload import build_task_ws_error_payload


def test_build_task_ws_error_payload_returns_none_for_non_http_exception() -> None:
    assert build_task_ws_error_payload(Exception("x")) is None


def test_build_task_ws_error_payload_returns_none_for_non_dict_detail() -> None:
    exc = HTTPException(status_code=402, detail="nope")
    assert build_task_ws_error_payload(exc) is None


def test_build_task_ws_error_payload_returns_payload_for_insufficient_funds() -> None:
    exc = HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={"error": "insufficient_funds", "available_kopeks": 0, "required_kopeks": 7, "currency": "RUB"},
    )
    payload = build_task_ws_error_payload(exc)
    assert isinstance(payload, dict)
    assert payload.get("status_code") == 402
    assert payload.get("content") == "Top up to keep working"
    assert isinstance(payload.get("detail"), dict)
    assert payload["detail"]["error"] == "insufficient_funds"

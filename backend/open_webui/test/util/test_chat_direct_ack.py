import pytest

from open_webui.utils.airis.direct_ack import DirectAckContext, coerce_direct_ack
from open_webui.utils.chat import generate_direct_chat_completion


def test_coerce_direct_ack_accepts_dict() -> None:
    assert coerce_direct_ack({"status": True}, context=DirectAckContext(request_id="r", channel="c")) == {
        "status": True
    }


@pytest.mark.parametrize("value", [None, "", "oops", 0, 1, [], [1], object()])
def test_coerce_direct_ack_rejects_non_dict(value: object) -> None:
    with pytest.raises(Exception):
        coerce_direct_ack(value, context=DirectAckContext(request_id="r", channel="c"))


@pytest.mark.asyncio
async def test_generate_direct_chat_completion_metadata_null_is_user_safe() -> None:
    # Regression: some deployments can send `metadata: null` for direct chat completions.
    # We must not crash with `'NoneType' object has no attribute 'get'`.
    with pytest.raises(Exception) as excinfo:
        await generate_direct_chat_completion(
            request=object(),  # not used by the function today
            form_data={"model": "m1", "metadata": None},
            user=object(),
            models={"m1": {}},
        )
    assert "Direct connection is unavailable" in str(excinfo.value)

import pytest

from open_webui.utils.airis.direct_ack import DirectAckContext, coerce_direct_ack


def test_coerce_direct_ack_accepts_dict() -> None:
    assert coerce_direct_ack({"status": True}, context=DirectAckContext(request_id="r", channel="c")) == {
        "status": True
    }


@pytest.mark.parametrize("value", [None, "", "oops", 0, 1, [], [1], object()])
def test_coerce_direct_ack_rejects_non_dict(value: object) -> None:
    with pytest.raises(Exception):
        coerce_direct_ack(value, context=DirectAckContext(request_id="r", channel="c"))

from open_webui.utils.airis.safe_get import deep_get_bool, deep_get_mapping


def test_deep_get_mapping_returns_empty_for_none_branch() -> None:
    data = {"info": None}
    result = deep_get_mapping(data, ("info", "meta"))
    assert result == {}


def test_deep_get_bool_returns_default_for_none_branch() -> None:
    data = {"info": {"meta": None}}
    value = deep_get_bool(data, ("info", "meta", "capabilities", "builtin_tools"), True)
    assert value is True


def test_deep_get_bool_parses_common_string_values() -> None:
    data_true = {"info": {"meta": {"capabilities": {"file_context": "true"}}}}
    data_false = {"info": {"meta": {"capabilities": {"file_context": "0"}}}}
    assert (
        deep_get_bool(
            data_true, ("info", "meta", "capabilities", "file_context"), default=False
        )
        is True
    )
    assert (
        deep_get_bool(
            data_false, ("info", "meta", "capabilities", "file_context"), default=True
        )
        is False
    )


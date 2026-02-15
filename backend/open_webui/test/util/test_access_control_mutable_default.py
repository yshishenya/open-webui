from _pytest.monkeypatch import MonkeyPatch


def test_has_permission_does_not_cache_mutable_default(monkeypatch: MonkeyPatch) -> None:
    import open_webui.utils.access_control as access_control

    # Force permission evaluation to use only DEFAULT_USER_PERMISSIONS (no group grants).
    monkeypatch.setattr(
        access_control.Groups,
        "get_groups_by_member_id",
        lambda *args, **kwargs: [],
    )

    monkeypatch.setattr(
        access_control,
        "DEFAULT_USER_PERMISSIONS",
        {"features": {"channels": True}},
    )
    assert access_control.has_permission("user-1", "features.channels") is True

    # Regression: previously, has_permission() used a shared mutable default dict and
    # would keep returning True even after DEFAULT_USER_PERMISSIONS changed.
    monkeypatch.setattr(access_control, "DEFAULT_USER_PERMISSIONS", {})
    assert access_control.has_permission("user-1", "features.channels") is False


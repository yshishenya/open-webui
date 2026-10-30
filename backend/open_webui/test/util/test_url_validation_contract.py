import socket

import pytest


def test_url_filter_and_private_address_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    from open_webui.retrieval.web import utils

    addresses = ['1.1.1.1', '2606:4700:4700::1111']
    resolved: list[str] = []

    def resolve(host: str) -> tuple[list[str], list[str]]:
        resolved.append(host)
        return [ip for ip in addresses if ':' not in ip], [ip for ip in addresses if ':' in ip]

    monkeypatch.setattr(utils, 'resolve_hostname', resolve)
    monkeypatch.setattr(utils, 'ENABLE_LOCAL_WEB_FETCH', False)
    cases: list[tuple[str, list[str], bool, bool]] = [
        ('https://public.example/path', [], True, True),
        ('http://public.example/path', ['public.example'], True, True),
        ('https://api.public.example/path', ['public.example'], True, True),
        ('https://evilpublic.example/path', ['public.example'], False, False),
        ('https://blocked.example/path', ['!blocked.example'], False, False),
        ('https://api.blocked.example/path', ['!blocked.example'], False, False),
        ('https://notblocked.example/path', ['!blocked.example'], True, True),
        ('https://blocked.example/public.example', ['public.example'], False, False),
        ('https://public.example/path', ['public.example', '!public.example'], False, False),
        ('ftp://public.example/path', [], False, False),
        ('https://public.example/\\x', [], False, False),
        ('https://public.example/\tx', [], False, False),
        ('https://public.example/\nx', [], False, False),
        ('https://public.example/\rx', [], False, False),
        ('not a URL', [], False, False),
    ]
    for url, filters, allowed, dns in cases:
        monkeypatch.setattr(utils, 'WEB_FETCH_FILTER_LIST', filters)
        resolved.clear()
        if allowed:
            assert utils.validate_url(url) is True
        else:
            with pytest.raises(ValueError):
                utils.validate_url(url)
        assert bool(resolved) is dns

    monkeypatch.setattr(utils, 'WEB_FETCH_FILTER_LIST', [])
    for ip in ['127.0.0.1', '10.0.0.1', '192.168.0.1', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1']:
        addresses = ['1.1.1.1', ip]
        with pytest.raises(ValueError):
            utils.validate_url('https://public.example/path')

    monkeypatch.setattr(utils, 'ENABLE_LOCAL_WEB_FETCH', True)
    resolved.clear()
    assert utils.validate_url('https://public.example/path') is True
    # Local fetching relaxes the private-address policy, but resolved IP block entries still apply.
    assert resolved == ['public.example']
    monkeypatch.setattr(utils, 'WEB_FETCH_FILTER_LIST', ['!public.example'])
    with pytest.raises(ValueError):
        utils.validate_url('https://public.example/path')

    monkeypatch.setattr(utils, 'WEB_FETCH_FILTER_LIST', ['!127.0.0.1'])
    for addresses in [['127.0.0.1'], ['::ffff:127.0.0.1']]:
        with pytest.raises(ValueError):
            utils.validate_url('https://public.example/path')

    monkeypatch.setattr(utils, 'ENABLE_LOCAL_WEB_FETCH', False)
    monkeypatch.setattr(utils, 'WEB_FETCH_FILTER_LIST', [])
    addresses = ['1.1.1.1']
    resolved.clear()
    assert utils.validate_url(('https://one.example', 'https://two.example')) is True
    assert resolved == ['one.example', 'two.example']
    assert utils.validate_url([]) is True
    assert utils.validate_url(42) is False
    resolved.clear()
    with pytest.raises(ValueError):
        utils.validate_url(['https://one.example', 'invalid', 'https://two.example'])
    assert resolved == ['one.example']
    assert utils.safe_validate_urls(['https://one.example', 'invalid', 'https://two.example']) == [
        'https://one.example',
        'https://two.example',
    ]

    def fail_dns(_host: str) -> tuple[list[str], list[str]]:
        raise socket.gaierror('DNS unavailable')

    monkeypatch.setattr(utils, 'resolve_hostname', fail_dns)
    with pytest.raises(ValueError):
        utils.validate_url('https://public.example')
    monkeypatch.setattr(utils, 'ENABLE_LOCAL_WEB_FETCH', True)
    assert utils.validate_url('https://public.example') is True

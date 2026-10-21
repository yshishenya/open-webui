#!/usr/bin/env python3
"""Check installed Mailu DNS: signed, unsigned and deliberately bogus zones."""

import argparse
import concurrent.futures
import json
import re
import subprocess

DOMAINS = (
    'proton.me',
    'gmail.com',
    'outlook.com',
    'yandex.ru',
    'mail.ru',
    'yahoo.com',
    'icloud.com',
    'fastmail.com',
    'shishenya.ru',
    'airis.you',
)


def query(container: str, name: str, kind: str, checking_disabled: bool = False) -> dict[str, object]:
    command = [
        'docker',
        'exec',
        container,
        'dig',
        '@127.0.0.1',
        name,
        kind,
        '+dnssec',
        '+time=5',
        '+tries=1',
        '+noall',
        '+comments',
        '+answer',
    ]
    if checking_disabled:
        command.append('+cdflag')
    result = subprocess.run(command, capture_output=True, text=True, timeout=10)
    text = result.stdout
    status = re.search(r'status: (\w+)', text)
    flags = re.search(r'flags: ([^;]+);', text)
    records = [line for line in text.splitlines() if line and not line.startswith(';')]
    return {
        'name': name,
        'type': kind,
        'status': status.group(1) if status else 'TIMEOUT',
        'ad': bool(flags and 'ad' in flags.group(1).split()),
        'checkingDisabled': checking_disabled,
        'records': records,
        'exit': result.returncode,
    }


def check(container: str) -> dict[str, object]:
    root = query(container, '.', 'NS')
    assert root['status'] == 'NOERROR' and root['ad'], root
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        mx = list(pool.map(lambda domain: query(container, domain, 'MX'), DOMAINS))
    hosts: list[str] = []
    for row in mx:
        assert row['status'] == 'NOERROR', row
        records = [line.split()[-1].rstrip('.') for line in row['records'] if ' IN MX ' in ' '.join(line.split())]
        assert records, row
        hosts.append(records[0])
        if row['name'] == 'proton.me':
            assert row['ad'], row
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        addresses = list(pool.map(lambda host: query(container, host, 'A'), hosts))
    for row in addresses:
        assert row['status'] == 'NOERROR' and any(' IN A ' in ' '.join(line.split()) for line in row['records']), row
    bogus = query(container, 'dnssec-failed.org', 'A')
    assert bogus['status'] == 'SERVFAIL', bogus
    unchecked = query(container, 'dnssec-failed.org', 'A', True)
    assert unchecked['status'] == 'NOERROR' and unchecked['records'] and not unchecked['ad'], unchecked
    tlsa = [query(container, '_25._tcp.' + host, 'TLSA') for host in ('mail.protonmail.ch', 'mailsec.protonmail.ch')]
    assert all(row['status'] in ('NOERROR', 'NXDOMAIN') and row['ad'] for row in tlsa), tlsa
    return {
        'accepted': True,
        'domains': len(mx),
        'dnssecEnforced': True,
        'root': root,
        'mx': mx,
        'addresses': addresses,
        'bogus': bogus,
        'checkingDisabledControl': unchecked,
        'tlsa': tlsa,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('container', help='Mailu Unbound container with installed dig')
    print(json.dumps(check(parser.parse_args().container), indent=2))

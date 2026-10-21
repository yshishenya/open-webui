# Mailu DNS and delivery checks

Use the existing Mailu installation on AIris (`/opt/projects/mailu`). Do not change
application SMTP credentials or switch providers to repair a resolver problem.

## Accepted configuration (2026-10-22)

Mailu images remain `2024.06.49`; Unbound is `1.20.0`. SMTP explicitly uses the
existing resolver (`192.168.203.254`) and waits for its health check:

```yaml
smtp:
  dns:
    - 192.168.203.254
  depends_on:
    front:
      condition: service_started
    resolver:
      condition: service_healthy
resolver:
  volumes:
    - ./overrides/unbound.conf:/unbound.conf:ro
    - ./unbound:/var/lib/unbound
```

These are additions to the existing service definitions, not replacements for
their images, environment, network or queue volume. The installed Unbound
`/unbound.conf` template is retained with two changes:

```text
# Within the existing server section:
auto-trust-anchor-file: /var/lib/unbound/trusted-key.key

# At the top level:
forward-zone:
  name: "."
  forward-addr: 8.8.8.8
  forward-addr: 8.8.4.4
  forward-first: no
  forward-tcp-upstream: yes
```

Unbound continues to validate signatures locally. TCP forwarding passed the
isolated and production checks; the precise packet-level cause of the previous
recursive resolution failures was not established. Keep DANE/DNSSEC and
certificate validation enabled. Never use `val-permissive-mode`, `domain-insecure`
or a TLS downgrade to make a delivery check green.

## Trust anchors must survive recreation

The old running resolver had already learned root key 38696 as VALID. The image's
initial file still had it in ADDPEND. Recreating directly from that old image can
therefore fail to validate the current root signatures. Preserve the learned
`trusted-key.key` from the running validator before recreation. For this repair,
keys 20326 and 38696 were independently checked against the official IANA root
anchor XML and their SHA256 DS digests.

The writable directory `/opt/projects/mailu/unbound` and its key file belong to
UID/GID `101:101` (Unbound). Mount the directory, not just the file: automatic key
maintenance needs atomic replacement. Do not reset the persistent state on
restart or treat the image's stale initial file as the current source of truth.

Official sources consulted:

- [Mailu Unbound template](https://github.com/Mailu/Mailu/blob/2024.06/optional/unbound/unbound.conf)
- [Unbound 1.20.0 configuration](https://github.com/NLnetLabs/unbound/blob/release-1.20.0/doc/example.conf.in)
- [IANA root anchors](https://data.iana.org/root-anchors/root-anchors.xml)

## Verification

After actual health readiness, run from a checkout on the Docker host:

```sh
python3 scripts/check_mailu_dns.py mailu-resolver-1
```

The command sends DNS queries only. It checks MX/A resolution for ten domains,
root and Proton authenticated DNS answers, both Proton MX TLSA lookups, and
rejection of `dnssec-failed.org`. A checking-disabled control must still resolve
the deliberately bogus domain, proving the rejection is from validation.

Also check the SMTP network namespace's Docker resolver (`127.0.0.11`): a valid
Proton MX answer must retain AD and the deliberately bogus domain must fail.
Inspect effective Docker DNS and `postconf` values, not just Compose text.

The repair passed in isolated Compose before and after recreation and in
production. Same installed image IDs, SMTP queue volume and Postfix security
settings were preserved. Other Mailu containers and the application were not
recreated by this repair.

## Queue backup and rollback

Before changing production, compare the current Compose source and resolved
configuration. Store a private, readable, checksum-verified backup on the server.
Briefly stop SMTP to snapshot its queue volume consistently; omit runtime socket
and PID directories. Save the exact queue volume name and image IDs.

For this repair the private backup is
`/opt/backups/airis-mailu-dns-20261022T2326Z` (mode 0700). It contains the original
Compose, environment, learned anchors, queue archive and SHA256 proof. Do not put
its environment or queue contents in Git or copy full archives to a Mac.

Recreate only resolver and SMTP with the installed images (`--no-deps --no-build
--pull never`). Do not use `down -v`, `--renew-anon-volumes`, global queue flushing
or message reinjection. Verify the exact existing `/queue` volume survives.

If acceptance fails, restore only this change's configuration after checking for
concurrent edits. Recreating the old resolver also requires restoring its saved
learned anchors into `/etc/unbound/trusted-key.key`, ownership `unbound:unbound`,
and reloading it. Restoring the old Compose alone is insufficient because the
image's initial anchors are stale. Keep the live queue volume; never overwrite
it with the archive after messages may have been delivered. Rollback returns the
old DNS behavior and is an emergency recovery, not a delivery fix.

## Acceptance limits and remaining Proton issue

On 2026-10-22, connection/EHLO/STARTTLS with verified certificates passed for
Gmail, Outlook, Yandex, Mail.ru, Yahoo, iCloud, Fastmail, shishenya.ru and airis.you.
No MAIL/RCPT/DATA was sent to unrelated recipients. The owner had already
confirmed actual Yandex receipt before this infrastructure change.

Proton remains unresolved: all six IPv4 MX endpoints timed out at TCP connect
from both AIris and its SMTP container. The same endpoints returned SMTP 220
from KVN in 0.1–0.3 seconds. A header-only capture on AIris `ens1` observed outgoing
SYN retransmissions to `185.70.42.128:25` and no replies during the bounded probe.
The local ruleset has no output filtering chain; DOCKER-USER is empty and the
Fail2ban input rule applies to SSH port 22. This narrows the remaining fault to
the network path or remote filtering; it does not identify which operator drops
traffic.

The original owner reset stayed in its original queue. Its one post-repair retry
at 23:28:06 UTC finished deferred `4.4.1` at 23:30:37 UTC; no DNSSEC warning recurred.
Do not claim Proton server acceptance or Inbox receipt. No new recovery token,
recipient, relay or campaign was created for this repair. The remaining action is
to restore TCP25 connectivity from `185.130.212.71` to Proton with the hosting
network/Proton operator, then check the existing queue before any new reset.
A reset delayed beyond its expiry needs a fresh normal recovery request only
after connectivity is restored; never extend token validity to hide the delay.

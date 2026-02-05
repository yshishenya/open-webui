from __future__ import annotations

from typing import Optional

from open_webui.internal.db import ScopedSession as Session
from open_webui.models.billing import LedgerEntry, LedgerEntryType, UsageEvent, Wallets


def get_ledger_entry(
    reference_id: str,
    reference_type: str,
    entry_type: LedgerEntryType,
) -> Optional[LedgerEntry]:
    return (
        Session.query(LedgerEntry)
        .filter(
            LedgerEntry.reference_id == reference_id,
            LedgerEntry.reference_type == reference_type,
            LedgerEntry.type == entry_type.value,
        )
        .first()
    )


def get_usage_event(request_id: str) -> Optional[UsageEvent]:
    return Session.query(UsageEvent).filter(UsageEvent.request_id == request_id).first()


def assert_wallet_topup_balance(wallet_id: str, expected_topup_kopeks: int) -> None:
    wallet = Wallets.get_wallet_by_id(wallet_id)
    assert wallet is not None
    assert wallet.balance_topup_kopeks == expected_topup_kopeks


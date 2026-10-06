"""Financial analytics uses verified facts, survives retries, and respects consent."""

import asyncio
import importlib.util
import sys
import types
from contextlib import asynccontextmanager
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import JSON, BigInteger, Boolean, Column, String, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Payment(Base):
    __tablename__ = 'payments'
    id = Column(String, primary_key=True)
    provider_payment_id = Column(String)
    user_id = Column(String)
    wallet_id = Column(String)
    provider = Column(String, default='yookassa')
    status = Column(String, default='succeeded')
    kind = Column(String, default='topup')
    created_at = Column(BigInteger)
    amount_kopeks = Column(BigInteger, default=1000)
    currency = Column(String, default='RUB')
    metadata_json = Column(JSON, default=dict)
    raw_payload_json = Column(JSON, default=dict)


class LedgerEntry(Base):
    __tablename__ = 'ledger'
    id = Column(String, primary_key=True)
    reference_id = Column(String)
    reference_type = Column(String, default='payment')
    type = Column(String, default='topup')
    user_id = Column(String)
    wallet_id = Column(String)
    created_at = Column(BigInteger)


class Identity(Base):
    __tablename__ = 'identities'
    id = Column(String, primary_key=True)
    user_id = Column(String)
    consent = Column(Boolean)
    granted_at = Column(BigInteger)


class Event(Base):
    __tablename__ = 'events'
    id = Column(String, primary_key=True)
    user_id = Column(String)
    name = Column(String)
    properties = Column(JSON)


class Refund(Base):
    __tablename__ = 'refunds'
    id = Column(String, primary_key=True)
    payment_id = Column(String)
    user_id = Column(String)
    amount_kopeks = Column(BigInteger)
    currency = Column(String)
    occurred_at = Column(BigInteger)


class FirstPayment(Base):
    __tablename__ = 'first_payment'
    user_id = Column(String, primary_key=True)
    payment_id = Column(String, unique=True)
    occurred_at = Column(BigInteger)


@pytest_asyncio.fixture
async def financial(tmp_path, monkeypatch):
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "facts.db"}')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def get_db():
        async with sessions() as session:
            yield session

    async def record(user_id, name, key, properties, occurred_at=None, db=None):
        identity = (await db.execute(select(Identity).where(Identity.user_id == user_id))).scalar_one_or_none()
        if identity is None or not identity.consent or occurred_at < max(100, identity.granted_at):
            return False
        if await db.get(Event, key):
            return False
        db.add(Event(id=key, user_id=user_id, name=name, properties=properties))
        await db.flush()
        return True

    def module(name, **values):
        fake = types.ModuleType(name)
        fake.__dict__.update(values)
        monkeypatch.setitem(sys.modules, name, fake)

    class EnumValue:
        def __init__(self, value):
            self.value = value

    module('open_webui.internal.db', get_async_db=get_db)
    module('open_webui.models.analytics', AnalyticsIdentity=Identity)
    module('open_webui.models.analytics_refunds', AnalyticsRefund=Refund, AnalyticsFirstPayment=FirstPayment)
    module(
        'open_webui.models.billing',
        Payment=Payment,
        LedgerEntry=LedgerEntry,
        Wallet=Identity,
        PaymentStatus=types.SimpleNamespace(SUCCEEDED=EnumValue('succeeded')),
        PaymentKind=types.SimpleNamespace(TOPUP=EnumValue('topup')),
        LedgerEntryType=types.SimpleNamespace(TOPUP=EnumValue('topup')),
    )
    module('open_webui.utils.airis.analytics', enabled_at=lambda: 100, record_account_event=record)
    module('open_webui.utils.yookassa', get_yookassa_client=lambda: None)
    from open_webui.utils.airis import billing_reporting_facts

    monkeypatch.setattr(billing_reporting_facts, 'Payment', Payment)
    monkeypatch.setattr(billing_reporting_facts, 'AnalyticsRefund', Refund)
    path = Path(__file__).parents[5] / 'open_webui/utils/airis/analytics_payments.py'
    spec = importlib.util.spec_from_file_location('financial_under_test', path)
    tested = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tested)
    async with sessions() as db:
        db.add(Identity(id='anon', user_id='user', consent=True, granted_at=150))
        for index, stamp in enumerate((120, 160, 170)):
            db.add(
                Payment(
                    id=f'p{index}',
                    provider_payment_id=f'provider{index}',
                    user_id='user',
                    wallet_id='wallet',
                    created_at=stamp,
                )
            )
            db.add(
                LedgerEntry(
                    id=f'l{index}',
                    reference_id=f'provider{index}',
                    user_id='user',
                    wallet_id='wallet',
                    created_at=stamp,
                )
            )
        await db.commit()
    yield tested, sessions
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize('stale_marker', [False, True])
async def test_explicit_tests_never_emit_purchase_or_steal_first_real_payment(financial, stale_marker: bool) -> None:
    tested, sessions = financial
    async with sessions() as db:
        test_payment = await db.get(Payment, 'p0')
        test_payment.raw_payload_json = {'test': True}
        if stale_marker:
            db.add(FirstPayment(user_id='user', payment_id='p0', occurred_at=120))
        await db.commit()
    assert not await tested.record_created_payment('p0')
    assert not await tested.record_confirmed_payment('provider0')
    assert await tested.record_confirmed_payment('provider1')
    assert not await tested.record_confirmed_payment('provider1')
    async with sessions() as db:
        marker = await db.get(FirstPayment, 'user')
        assert marker.payment_id == 'p1'
        event = await db.get(Event, 'first_payment_confirmed')
        assert event.properties['payment_id'] == 'p1'
        assert await db.get(Event, 'payment_confirmed:p0') is None
    assert await tested.repair_created_payments(batch_size=1) == (160, 'p1')
    assert await tested.repair_confirmed_payments(batch_size=1) == (160, 'p1')


@pytest.mark.asyncio
async def test_verified_test_refund_is_persisted_but_never_emitted_or_repaired(financial) -> None:
    tested, sessions = financial
    async with sessions() as db:
        payment = await db.get(Payment, 'p1')
        payment.raw_payload_json = {'test': True}
        await db.commit()

    class Client:
        async def get_refund(self, refund_id: str) -> dict[str, object]:
            return {
                'id': refund_id,
                'payment_id': 'provider1',
                'status': 'succeeded',
                'amount': {'value': '4.00', 'currency': 'RUB'},
                'created_at': '1970-01-01T00:03:00Z',
            }

    tested.get_yookassa_client = lambda: Client()
    assert not await tested.record_verified_refund('test-refund', 'provider1')
    assert not await tested.record_confirmed_refund('test-refund')
    assert await tested.repair_confirmed_refunds(batch_size=1) is None
    async with sessions() as db:
        assert await db.get(Refund, 'test-refund') is not None
        assert (await db.execute(select(Event))).scalars().all() == []


@pytest.mark.asyncio
async def test_recovery_without_browser_duplicate_pagination_and_consent(financial):
    tested, sessions = financial
    cursor = await tested.repair_confirmed_payments(batch_size=1)
    assert cursor == (160, 'p1')
    cursor = await tested.repair_confirmed_payments(cursor, batch_size=1)
    assert cursor == (170, 'p2')
    assert await tested.repair_confirmed_payments(cursor, batch_size=1) is None
    assert not await tested.record_confirmed_payment('provider1')
    async with sessions() as db:
        events = (await db.execute(select(Event))).scalars().all()
        assert len(events) == 2
        assert all(not event.properties['is_first_payment'] for event in events)
        identity = await db.get(Identity, 'anon')
        identity.consent = False
        await db.commit()
    assert await tested.repair_confirmed_payments() is None


@pytest.mark.asyncio
async def test_refunds_verified_partial_dedup_repair_and_mismatch(financial):
    tested, sessions = financial

    class Client:
        async def get_refund(self, refund_id):
            return {
                'id': refund_id,
                'payment_id': 'provider1',
                'status': 'succeeded',
                'amount': {'value': '4.00', 'currency': 'RUB'},
                'created_at': '1970-01-01T00:03:00Z',
            }

    tested.get_yookassa_client = lambda: Client()
    assert await tested.record_verified_refund('r1', 'provider1')
    assert not await tested.record_verified_refund('r1', 'provider1')
    assert await tested.record_verified_refund('r2', 'provider1')
    with pytest.raises(ValueError, match='total exceeds'):
        await tested.record_verified_refund('r3', 'provider1')
    with pytest.raises(ValueError, match='mismatch'):
        await tested.record_verified_refund('r4', 'provider2')
    async with sessions() as db:
        event = await db.get(Event, 'refund_confirmed:r2')
        await db.delete(event)
        await db.commit()
    assert await tested.repair_confirmed_refunds(batch_size=1) == (180, 'r1')
    assert await tested.repair_confirmed_refunds((180, 'r1'), batch_size=2) is None
    async with sessions() as db:
        assert await db.get(Event, 'refund_confirmed:r2') is not None
        assert len((await db.execute(select(LedgerEntry))).all()) == 3


@pytest.mark.asyncio
async def test_invalid_amounts_and_timestamps(financial):
    tested, _ = financial
    for value in ('NaN', 'Infinity', '-1.00', '0.001', '', None):
        with pytest.raises(ValueError):
            tested._refund_amount(value)
    assert tested._refund_amount('1.01') == 101
    with pytest.raises(ValueError):
        tested._provider_timestamp('2026-10-01T12:00:00')


@pytest.mark.asyncio
async def test_crashed_payment_hook_is_repaired_and_first_is_unique(financial):
    tested, sessions = financial
    async with sessions() as db:
        old = await db.get(Payment, 'p0')
        ledger = await db.get(LedgerEntry, 'l0')
        await db.delete(ledger)
        await db.delete(old)
        await db.commit()
    # No callback/event happened when billing committed. The next sweep repairs it.
    assert await tested.repair_confirmed_payments() is None
    assert not await tested.record_confirmed_payment('provider1')
    async with sessions() as db:
        first = await db.get(Event, 'first_payment_confirmed')
        assert first.properties['payment_id'] == 'p1'
        purchases = (await db.execute(select(Event).where(Event.name == 'payment_confirmed'))).scalars().all()
        assert len(purchases) == 2
        assert sum(event.properties['is_first_payment'] for event in purchases) == 1


@pytest.mark.asyncio
async def test_refund_financial_fact_survives_consent_denial(financial):
    tested, sessions = financial
    async with sessions() as db:
        identity = await db.get(Identity, 'anon')
        identity.consent = False
        await db.commit()

    class Client:
        async def get_refund(self, refund_id):
            return {
                'id': refund_id,
                'payment_id': 'provider1',
                'status': 'succeeded',
                'amount': {'value': '4.00', 'currency': 'RUB'},
                'created_at': '1970-01-01T00:03:00Z',
            }

    tested.get_yookassa_client = lambda: Client()
    assert not await tested.record_verified_refund('private_refund', 'provider1')
    async with sessions() as db:
        assert await db.get(Refund, 'private_refund') is not None
        assert await db.get(Event, 'refund_confirmed:private_refund') is None


@pytest.mark.asyncio
async def test_first_marker_does_not_flip_for_late_same_second_payment(financial):
    tested, sessions = financial
    async with sessions() as db:
        await db.delete(await db.get(LedgerEntry, 'l0'))
        await db.delete(await db.get(Payment, 'p0'))
        await db.commit()
    assert await tested.record_confirmed_payment('provider1')
    async with sessions() as db:
        db.add(Payment(id='a-late', provider_payment_id='late', user_id='user', wallet_id='wallet', created_at=160))
        db.add(LedgerEntry(id='late-ledger', reference_id='late', user_id='user', wallet_id='wallet', created_at=160))
        await db.commit()
    assert await tested.record_confirmed_payment('late')
    async with sessions() as db:
        marker = await db.get(FirstPayment, 'user')
        assert marker.payment_id == 'p1'
        late = await db.get(Event, 'payment_confirmed:a-late')
        assert not late.properties['is_first_payment']
        assert (await db.get(Event, 'payment_confirmed:p1')).properties['is_first_payment']


@pytest.mark.asyncio
async def test_created_payment_requires_persisted_provider_and_recovers(financial):
    tested, sessions = financial
    assert not await tested.record_created_payment('p0')  # before consent
    assert await tested.repair_created_payments(batch_size=1) == (160, 'p1')
    assert await tested.repair_created_payments((160, 'p1'), batch_size=5) is None
    assert not await tested.record_created_payment('p1')
    async with sessions() as db:
        db.add(Payment(id='uncreated', user_id='user', wallet_id='wallet', created_at=180))
        await db.commit()
    assert not await tested.record_created_payment('uncreated')
    async with sessions() as db:
        events = (await db.execute(select(Event).where(Event.name == 'payment_created'))).scalars().all()
        assert len(events) == 2


@pytest.mark.asyncio
async def test_concurrent_first_marker_has_one_winner(financial):
    tested, sessions = financial
    async with sessions() as db:
        identity = await db.get(Identity, 'anon')
        identity.consent = False
        await db.commit()
    await asyncio.gather(tested.record_confirmed_payment('provider1'), tested.record_confirmed_payment('provider2'))
    async with sessions() as db:
        markers = (await db.execute(select(FirstPayment))).scalars().all()
        assert len(markers) == 1
        assert markers[0].payment_id == 'p0'

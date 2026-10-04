"""Disposable ASGI wrapper: real AIRIS, local external protocols only."""

import asyncio
import json
import logging
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from email import policy
from email.parser import BytesParser
from html import escape
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException
from fastapi.responses import (
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
    StreamingResponse,
)
from pydantic import BaseModel


def create_app() -> FastAPI:
    if os.getenv('AIRIS_ONBOARDING_PATHS_TEST') != '1':
        raise RuntimeError('This wrapper requires an explicitly disposable test application')
    from open_webui.main import app

    return app


app = create_app()

MODEL = 'gpt-5.6-luna'
ANSWER = 'AIRIS deterministic answer.'
USAGE = {'prompt_tokens': 17, 'completion_tokens': 3, 'total_tokens': 20}
calls: list[dict[str, object]] = []
mail: list[dict[str, str]] = []


async def capture_message(reader: asyncio.StreamReader, recipient: str) -> dict[str, str]:
    payload: list[bytes] = []
    while line := await asyncio.wait_for(reader.readline(), timeout=30):
        if line.rstrip(b'\r\n') == b'.':
            message = BytesParser(policy=policy.default).parsebytes(b''.join(payload))
            text = '\n'.join(
                str(part.get_content()) for part in message.walk() if part.get_content_type() == 'text/plain'
            )
            return {
                'recipient': recipient,
                'subject': str(message['Subject']),
                'reply_to': str(message['Reply-To'] or ''),
                'message_id': str(message['Message-ID']),
                'text': text,
            }
        payload.append(line[1:] if line.startswith(b'..') else line)
    raise ConnectionError('Incomplete fixture DATA')


async def smtp(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    """Capture complete DATA; reject every address outside this fixture namespace."""
    recipient = ''

    async def reply(value: bytes) -> None:
        writer.write(value + b'\r\n')
        await writer.drain()

    try:
        await reply(b'220 fixture ESMTP')
        while line := await asyncio.wait_for(reader.readline(), timeout=30):
            command = line.decode('ascii').strip()
            verb = command.split(' ', 1)[0].upper()
            if verb in {'EHLO', 'HELO'}:
                writer.write(b'250-fixture\r\n250 AUTH PLAIN\r\n')
                await writer.drain()
            elif verb == 'RCPT':
                address = command.split(':', 1)[-1].strip().split(' ')[0].strip('<>').lower()
                recipient = address if address.startswith('fullpaths-') and address.endswith('@airis.you') else ''
                await reply(b'250 recipient' if recipient else b'550 forbidden recipient')
            elif verb == 'DATA':
                if recipient:
                    await reply(b'354 end with dot')
                    mail.append(await capture_message(reader, recipient))
                    await reply(b'250 accepted')
                else:
                    await reply(b'550 forbidden recipient')
            elif verb == 'QUIT':
                await reply(b'221 closing')
                break
            else:
                await reply(
                    {'AUTH': b'235 authenticated', 'MAIL': b'250 ok', 'RSET': b'250 ok', 'NOOP': b'250 ok'}.get(
                        verb, b'502 unsupported'
                    )
                )
    except (TimeoutError, ConnectionError):
        logging.warning('Local SMTP connection ended before a complete fixture exchange')
    finally:
        writer.close()
        await writer.wait_closed()


original_lifespan = app.router.lifespan_context


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    async with await asyncio.start_server(smtp, '127.0.0.1', 2525):
        async with original_lifespan(application):
            yield


app.router.lifespan_context = lifespan


@app.get('/_fixture/v1/models')
async def models() -> dict[str, object]:
    return {
        'object': 'list',
        'data': [{'id': MODEL, 'name': MODEL, 'owned_by': 'openai'}],
    }


class Completion(BaseModel):
    model: str
    messages: list[dict[str, object]]
    stream: bool = False


@app.post('/_fixture/v1/chat/completions', response_model=None)
async def completion(body: Completion) -> JSONResponse | StreamingResponse:
    if body.model != MODEL:
        raise HTTPException(400, 'Unexpected model: no paid fallback in this fixture')
    failed = any('E2E_FORCE_ERROR' in str(item.get('content')) for item in body.messages)
    calls.append({'model': body.model, 'failed': failed, 'usage': None if failed else USAGE})
    if failed:
        return JSONResponse({'error': {'message': 'Fixture provider failed'}}, status_code=503)
    common = {'id': 'chatcmpl-' + str(uuid.uuid4()), 'model': MODEL, 'created': 1}
    if not body.stream:
        return JSONResponse(
            {
                **common,
                'object': 'chat.completion',
                'usage': USAGE,
                'choices': [
                    {
                        'index': 0,
                        'message': {'role': 'assistant', 'content': ANSWER},
                        'finish_reason': 'stop',
                    }
                ],
            }
        )

    async def chunks() -> AsyncIterator[str]:
        for delta, finish in [
            ({'role': 'assistant', 'content': ANSWER}, None),
            ({}, 'stop'),
        ]:
            event = {
                **common,
                'object': 'chat.completion.chunk',
                'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}],
            }
            yield 'data: ' + json.dumps(event) + '\n\n'
        yield 'data: ' + json.dumps({**common, 'choices': [], 'usage': USAGE}) + '\n\n'
        yield 'data: [DONE]\n\n'

    return StreamingResponse(chunks(), media_type='text/event-stream')


class PaymentBody(BaseModel):
    amount: dict[str, str]
    metadata: dict[str, str | int]
    confirmation: dict[str, str]


class PaymentState(PaymentBody):
    id: str
    status: str = 'pending'
    paid: bool = False
    test: bool = True
    created_at: str = '2026-10-04T00:00:00Z'


payments: dict[str, PaymentState] = {}


@app.post('/_fixture/v3/payments')
async def create_payment(body: PaymentBody) -> dict[str, object]:
    if body.amount != {'value': '500.00', 'currency': 'RUB'}:
        raise HTTPException(400, 'Fixture permits only a 500 RUB test payment')
    if urlsplit(body.confirmation.get('return_url', '')).netloc != 'onboarding-paths:8080':
        raise HTTPException(400, 'Fixture payment must return to the disposable application')
    payment = PaymentState(**body.model_dump(), id=str(uuid.uuid4()))
    payments[payment.id] = payment
    result = payment.model_dump()
    result['confirmation'] = {
        'type': 'redirect',
        'confirmation_url': os.environ['WEBUI_URL'] + '/_fixture/checkout/' + payment.id,
    }
    return result


@app.get('/_fixture/v3/payments/{payment_id}')
async def get_payment(payment_id: str) -> dict[str, object]:
    return payments[payment_id].model_dump()


@app.get('/_fixture/checkout/{payment_id}', response_class=HTMLResponse)
async def checkout(payment_id: str) -> str:
    if payment_id not in payments:
        raise HTTPException(404, 'Unknown fixture payment')
    return f'<form method="post"><button>Pay 500 RUB in local fixture</button></form><p>{escape(payment_id)}</p>'


@app.post('/_fixture/checkout/{payment_id}')
async def pay(payment_id: str) -> RedirectResponse:
    payment = payments[payment_id]
    payment.status, payment.paid = 'succeeded', True
    return RedirectResponse(payment.confirmation['return_url'], status_code=303)


@app.post('/_fixture/drain')
async def drain() -> dict[str, bool]:
    from open_webui.utils.airis.email_queue import drain_email_queue
    from open_webui.utils.airis.email_scenarios import EmailQueueConfig

    await drain_email_queue(EmailQueueConfig.from_env())
    return {'completed': True}


@app.get('/_fixture/state')
async def state(recipient: str = '') -> dict[str, object]:
    return {
        'calls': calls,
        'mail': [item for item in mail if item['recipient'] == recipient],
    }


@app.get('/_fixture/facts/{user_id}')
async def facts(user_id: str) -> dict[str, object]:
    from open_webui.internal.db import get_async_db_context
    from open_webui.models.billing_wallet import LedgerEntry, UsageEvent
    from open_webui.models.task_success import TaskSuccess
    from sqlalchemy import func, select

    async with get_async_db_context() as session:
        success = await session.scalar(
            select(func.count()).select_from(TaskSuccess).where(TaskSuccess.user_id == user_id)
        )
        usage = (await session.scalars(select(UsageEvent).where(UsageEvent.user_id == user_id))).all()
        ledger = (await session.scalars(select(LedgerEntry).where(LedgerEntry.user_id == user_id))).all()
        return {
            'successes': success,
            'usage': [
                {
                    'model': item.model_id,
                    'input': item.prompt_tokens,
                    'output': item.completion_tokens,
                    'source': item.billing_source,
                    'charged': item.cost_charged_kopeks,
                }
                for item in usage
            ],
            'ledger': [{'amount': item.amount_kopeks, 'reference': item.reference_id} for item in ledger],
        }


# Test APIs must precede the unchanged application SPA catchall.
app.router.routes.sort(key=lambda route: getattr(route, 'name', '') == 'spa-static-files')

import { createHmac } from 'node:crypto';
import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import {
	test,
	state,
	facts,
	billing,
	signIn,
	type Account,
	type Mail
} from './onboarding-paths.fixture';

type Delivery = {
	id: string;
	type: string;
	provider_payment_id: string;
	status: string;
	reason: string | null;
	attempts: number;
	provider_id: string;
	due_at: number;
	updated_at: number;
	submitted_at: number | null;
};

async function checkout(page: Page, account: Account): Promise<string> {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/billing/balance');
	await page.getByTestId('topup-preset').first().click();
	await page.getByTestId('topup-proceed').click();
	await expect(page.getByRole('button', { name: 'Pay 500 RUB in local fixture' })).toBeVisible();
	return new URL(page.url()).pathname.split('/').at(-1)!;
}

async function control(
	client: APIRequestContext,
	payment: string,
	status: 'pending' | 'succeeded' | 'canceled',
	paid = false,
	unavailable = false
): Promise<void> {
	const response = await client.post(`/_fixture/payment/${payment}`, {
		data: { status, paid, unavailable }
	});
	expect(response.ok()).toBe(true);
}

async function notify(
	client: APIRequestContext,
	payment: string,
	event = 'payment.succeeded'
): Promise<APIResponse> {
	const data = JSON.stringify({
		type: 'notification',
		event,
		// Deliberately wrong amount/owner: the real provider GET is authoritative.
		object: {
			id: payment,
			status: event.slice(8),
			paid: true,
			amount: { value: '999.00', currency: 'USD' },
			metadata: { user_id: 'forged' }
		}
	});
	return client.post('/api/v1/billing/webhook/yookassa?token=local-fixture-only', {
		data,
		headers: {
			'Content-Type': 'application/json',
			'X-YooKassa-Timestamp': String(Math.floor(Date.now() / 1000)),
			'X-YooKassa-Signature': createHmac('sha256', 'local-fixture-only').update(data).digest('hex')
		}
	});
}

async function reconcile(
	client: APIRequestContext,
	account: Account,
	payment: string
): Promise<APIResponse> {
	return client.post('/api/v1/billing/topup/reconcile', {
		headers: { Authorization: `Bearer ${account.token}` },
		data: { payment_id: payment }
	});
}

async function drain(client: APIRequestContext): Promise<void> {
	expect((await client.post('/_fixture/drain')).ok()).toBe(true);
}

async function notices(client: APIRequestContext, account: Account): Promise<Mail[]> {
	return (await state(client, account.email)).mail.filter(
		(item) => item.subject === 'Баланс AIRIS пополнен'
	);
}

async function jobs(client: APIRequestContext, account: Account): Promise<Delivery[]> {
	const response = await client.get(`/_fixture/deliveries/${account.id}`);
	expect(response.ok()).toBe(true);
	return ((await response.json()) as Delivery[]).filter((item) => item.type === 'topup_credited');
}

async function credit(
	client: APIRequestContext,
	account: Account,
	payment?: string
): Promise<void> {
	expect((await billing(client, account, 'balance')).balance_topup_kopeks).toBe(
		payment ? 50000 : 0
	);
	expect((await facts(client, account)).ledger).toEqual(
		payment ? [{ amount: 50000, reference: payment }] : []
	);
}

async function history(page: Page): Promise<void> {
	await page.goto('/billing/history');
	const entries = page.getByRole('article', { name: /^Top-up,/ });
	await expect(entries).toHaveCount(1);
	await expect(entries.getByText('+RUB 500.00', { exact: true })).toBeVisible();
}

test('closed checkout, delayed notification and mismatched provider status recover once', async ({
	page,
	context,
	request,
	account
}) => {
	const payment = await checkout(page, account);
	const unauthorized = await request.post('/api/v1/billing/webhook/yookassa', { data: {} });
	expect(unauthorized.status()).toBe(401);
	const unsigned = await request.post('/api/v1/billing/webhook/yookassa?token=local-fixture-only', {
		data: {}
	});
	expect(unsigned.status()).toBe(401);
	expect((await reconcile(request, account, payment)).ok()).toBe(true);
	expect((await notify(request, payment)).status()).toBe(503);
	await control(request, payment, 'succeeded'); // paid=false must still reject.
	expect((await notify(request, payment)).status()).toBe(503);
	await drain(request);
	await credit(request, account);
	expect(await jobs(request, account)).toEqual([]);
	expect(await notices(request, account)).toEqual([]);
	await page.close();
	await control(request, payment, 'succeeded', true);
	expect((await notify(request, payment)).ok()).toBe(true);
	// True concurrent backend requests, without browser route response substitution.
	const repeats = await Promise.all([
		notify(request, payment),
		notify(request, payment),
		reconcile(request, account, payment),
		reconcile(request, account, payment)
	]);
	for (const response of repeats) expect(response.ok()).toBe(true);
	await credit(request, account, payment);
	await drain(request);
	const first = await notices(request, account);
	expect(first).toHaveLength(1);
	expect(first[0].reply_to).toBe('support@airis.you');
	expect(await jobs(request, account)).toMatchObject([
		{
			provider_payment_id: payment,
			status: 'accepted',
			attempts: 1,
			provider_id: first[0].message_id
		}
	]);
	await drain(request);
	expect(await notices(request, account)).toEqual(first);
	const reopened = await context.newPage();
	const errors: string[] = [];
	reopened.on('pageerror', (error) => errors.push(error.message));
	try {
		await reopened.addInitScript(() => localStorage.setItem('locale', 'en-US'));
		await history(reopened);
		expect(errors).toEqual([]);
	} finally {
		await reopened.close();
	}
});

test('unavailable provider on checkout return keeps zero credit and recovers through Refresh', async ({
	page,
	request,
	account
}) => {
	const payment = await checkout(page, account);
	await control(request, payment, 'pending', false, true);
	expect((await notify(request, payment)).status()).toBe(503);
	await page.getByRole('button', { name: 'Pay 500 RUB in local fixture' }).click();
	await expect(
		page.getByText('Payment status could not be checked', { exact: true })
	).toBeVisible();
	await drain(request);
	await credit(request, account);
	expect(await jobs(request, account)).toEqual([]);
	expect(await notices(request, account)).toEqual([]);
	await control(request, payment, 'succeeded', true);
	await page
		.getByRole('status')
		.filter({ hasText: 'Payment status could not be checked' })
		.getByRole('button', { name: 'Refresh', exact: true })
		.click();
	await expect(page.getByText('Top-up successful', { exact: true })).toBeVisible();
	for (let index = 0; index < 2; index++) {
		expect((await notify(request, payment)).ok()).toBe(true);
		expect((await reconcile(request, account, payment)).ok()).toBe(true);
		await drain(request);
	}
	await credit(request, account, payment);
	expect(await notices(request, account)).toHaveLength(1);
	await history(page);
});

test('canceled provider payment gives no credit or credited email on repeated callbacks', async ({
	page,
	request,
	account
}) => {
	const payment = await checkout(page, account);
	await control(request, payment, 'canceled');
	for (let index = 0; index < 2; index++) {
		expect((await notify(request, payment, 'payment.canceled')).ok()).toBe(true);
		const response = await reconcile(request, account, payment);
		expect(response.ok()).toBe(true);
		expect(await response.json()).toMatchObject({ credited: false, provider_status: 'canceled' });
		await drain(request);
	}
	await credit(request, account);
	expect(await jobs(request, account)).toEqual([]);
	expect(await notices(request, account)).toEqual([]);
});

test('temporary SMTP refusal preserves credit and retries exactly one durable Message-ID', async ({
	page,
	request,
	account
}) => {
	const payment = await checkout(page, account);
	expect(
		(
			await request.post('/_fixture/smtp/refuse-once', { params: { recipient: account.email } })
		).ok()
	).toBe(true);
	await page.getByRole('button', { name: 'Pay 500 RUB in local fixture' }).click();
	await expect(page.getByText('Top-up successful', { exact: true })).toBeVisible();
	await credit(request, account, payment);
	await drain(request);
	const retry = await jobs(request, account);
	expect(retry).toHaveLength(1);
	expect(retry[0]).toMatchObject({
		provider_payment_id: payment,
		status: 'retry',
		reason: 'smtp_temporary',
		attempts: 1,
		submitted_at: null
	});
	expect(retry[0].due_at - retry[0].updated_at).toBe(300);
	expect(await notices(request, account)).toEqual([]);
	expect((await notify(request, payment)).ok()).toBe(true);
	expect((await reconcile(request, account, payment)).ok()).toBe(true);
	await drain(request);
	expect(await jobs(request, account)).toEqual(retry);
	await credit(request, account, payment);
	// Explicit scheduling control for this proven-unsent retry; real clocks unchanged.
	expect((await request.post(`/_fixture/retry-due/${retry[0].id}`)).ok()).toBe(true);
	await drain(request);
	const accepted = await notices(request, account);
	expect(accepted).toHaveLength(1);
	expect(accepted[0].message_id).toBe(retry[0].provider_id);
	expect(accepted[0].reply_to).toBe('support@airis.you');
	expect(await jobs(request, account)).toMatchObject([
		{ id: retry[0].id, status: 'accepted', attempts: 2, provider_id: retry[0].provider_id }
	]);
	expect((await request.post(`/_fixture/retry-due/${retry[0].id}`)).status()).toBe(409);
	await drain(request);
	expect(await notices(request, account)).toEqual(accepted);
	await credit(request, account, payment);
	await history(page);
});

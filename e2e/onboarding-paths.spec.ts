import { randomUUID } from 'node:crypto';
import {
	expect,
	request as apiRequest,
	test as base,
	type APIRequestContext,
	type Page
} from '@playwright/test';

type Account = { id: string; email: string; password: string; token: string };
type Facts = {
	successes: number;
	usage: { model: string; input: number; output: number; source: string; charged: number }[];
	ledger: { amount: number; reference: string }[];
};
type Mail = { subject: string; text: string; message_id: string; reply_to: string };
type State = {
	calls: {
		model: string;
		failed: boolean;
		usage: { prompt_tokens: number; completion_tokens: number } | null;
	}[];
	mail: Mail[];
};

const test = base.extend<{ account: Account }>({
	page: async ({ page }, use) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await use(page);
		expect(errors).toEqual([]);
	},
	account: async ({ baseURL }, use) => {
		const client = await apiRequest.newContext({ baseURL });
		try {
			const credentials = {
				email: `fullpaths-${randomUUID()}@airis.you`,
				password: 'local-fixture-only'
			};
			const signup = await client.post('/api/v1/auths/signup', {
				data: {
					...credentials,
					name: 'Local ordinary fixture',
					terms_accepted: true,
					privacy_accepted: true,
					product_emails_opt_in: false
				}
			});
			expect(signup.ok()).toBe(true);
			const account = (await signup.json()) as Account & { role: string };
			expect(account.role).toBe('user');
			const captured = await state(client, credentials.email);
			const verification = captured.mail
				.flatMap((mail) => mail.text.match(/https?:\/\/[^\s<>]+/g) || [])
				.find((url) => url.includes('/verify-email'));
			expect(verification).toBeTruthy();
			const verified = await client.get('/api/v1/auths/verify-email', {
				params: { token: new URL(verification!).searchParams.get('token')! }
			});
			expect(verified.ok()).toBe(true);
			await use({ ...account, ...credentials });
		} finally {
			await client.dispose();
		}
	}
});

async function state(client: APIRequestContext, recipient = ''): Promise<State> {
	const response = await client.get('/_fixture/state', { params: { recipient } });
	expect(response.ok()).toBe(true);
	return response.json() as Promise<State>;
}
async function facts(client: APIRequestContext, account: Account): Promise<Facts> {
	const response = await client.get(`/_fixture/facts/${account.id}`);
	expect(response.ok()).toBe(true);
	return response.json() as Promise<Facts>;
}
async function billing(
	client: APIRequestContext,
	account: Account,
	path: string
): Promise<Record<string, unknown>> {
	const response = await client.get(`/api/v1/billing/${path}`, {
		headers: { Authorization: `Bearer ${account.token}` }
	});
	expect(response.ok()).toBe(true);
	return response.json() as Promise<Record<string, unknown>>;
}
async function signIn(page: Page, account: Account): Promise<void> {
	await expect(page.getByPlaceholder('Enter Your Password')).toBeVisible();
	if (await page.getByRole('textbox', { name: 'Name', exact: true }).isVisible())
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await page.getByRole('textbox', { name: /email/i }).fill(account.email);
	await page.getByPlaceholder('Enter Your Password').fill(account.password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toBeVisible();
}

async function openSidebar(page: Page): Promise<void> {
	const button = page.getByRole('button', { name: 'Open Sidebar', exact: true });
	await expect(button).toBeVisible();
	await expect.poll(async () => (await button.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0);
	const bounds = await button.boundingBox();
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
	await button.click();
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('locale', 'en-US');
		localStorage.setItem('settings', JSON.stringify({ version: '0.11.0' }));
		localStorage.setItem('airis.analytics.consent.v1', 'denied');
	});
});

for (const example of ['написать текст', 'разобраться в теме', 'составить план']) {
	test(`guide → login → answer → exact free quota: ${example}`, async ({
		page,
		request,
		account
	}) => {
		const before = (await billing(request, account, 'lead-magnet')).usage;
		const providerBefore = (await state(request)).calls.length;
		await page.goto('/guide');
		await page.getByRole('link', { name: `Открыть задачу: ${example}` }).click();
		await expect(page).toHaveURL(/\/auth\?/);
		const draft = new URL(
			new URL(page.url()).searchParams.get('redirect')!,
			'http://onboarding-paths'
		).searchParams.get('q')!;
		await signIn(page, account);
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
			draft
		);
		await expect(page.getByRole('button', { name: 'Selected model: gpt-5.6-luna' })).toBeVisible();
		expect((await state(request)).calls.length).toBe(providerBefore);
		await expect(page.getByRole('log').getByRole('listitem')).toHaveCount(0);
		await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
		await expect(page.getByRole('log').getByRole('listitem')).toHaveCount(2);
		await expect(
			page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
		).toBeVisible();
		await expect
			.poll(() => facts(request, account))
			.toEqual({
				successes: 1,
				usage: [{ model: 'gpt-5.6-luna', input: 17, output: 3, source: 'lead_magnet', charged: 0 }],
				ledger: []
			});
		const usage = (await billing(request, account, 'lead-magnet')).usage as {
			tokens_input: number;
			tokens_output: number;
		};
		expect(before).toMatchObject({ tokens_input: 0, tokens_output: 0 });
		expect(usage).toMatchObject({ tokens_input: 17, tokens_output: 3 });
		expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(0);
		expect((await state(request)).calls.slice(providerBefore)).toEqual([
			{
				model: 'gpt-5.6-luna',
				failed: false,
				usage: { prompt_tokens: 17, completion_tokens: 3, total_tokens: 20 }
			}
		]);
		await openSidebar(page);
		await page.getByRole('button', { name: 'Close Sidebar', exact: true }).click();
		await page.reload();
		await expect(
			page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
		).toBeVisible();
		expect((await facts(request, account)).successes).toBe(1);
		await openSidebar(page);
		await page.getByRole('link', { name: 'New Chat', exact: true }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toHaveText('');
		expect((await state(request)).calls.length).toBe(providerBefore + 1);
	});
}

test('failed provider response consumes no quota, money or completed success', async ({
	page,
	request,
	account
}) => {
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&q=E2E_FORCE_ERROR&submit=false');
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		'E2E_FORCE_ERROR'
	);
	await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
	await expect(page.getByText('Fixture provider failed', { exact: false }).first()).toBeVisible();
	expect(await facts(request, account)).toEqual({ successes: 0, usage: [], ledger: [] });
	expect((await billing(request, account, 'lead-magnet')).usage).toMatchObject({
		tokens_input: 0,
		tokens_output: 0
	});
	expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(0);
});

test('checkout → exact credit → visible history → one service email, replay gives zero duplicates', async ({
	page,
	request,
	account
}) => {
	const headers = { Authorization: `Bearer ${account.token}` };
	const providerBefore = (await state(request)).calls.length;
	await page.goto('/auth?form=1');
	await signIn(page, account);
	await page.goto('/?model=gpt-5.6-luna&q=Payment%20return%20test&submit=false');
	await expect(page.getByLabel(/^(Send a Message|How can I help you today\?)$/)).toContainText(
		'Payment return test'
	);
	await page.getByLabel(/^(Send a Message|How can I help you today\?)$/).press('Enter');
	await expect(
		page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
	).toBeVisible();
	await expect(page).toHaveURL(/\/c\//);
	const chatURL = page.url();
	if ((page.viewportSize()?.width ?? 1000) < 640) {
		await openSidebar(page);
		await page.getByRole('button', { name: 'User menu', exact: true }).last().click();
		await page.getByTestId('user-menu-billing').click();
	} else {
		await page.getByRole('link', { name: /^Open wallet:/ }).click();
	}
	const created = page.waitForResponse(
		(response) => response.url().endsWith('/api/v1/billing/topup') && response.status() === 200
	);
	await page.getByTestId('topup-preset').first().click();
	await page.getByTestId('topup-proceed').click();
	await created;
	await expect(page.getByRole('button', { name: 'Pay 500 RUB in local fixture' })).toBeVisible();
	const payment = { payment_id: new URL(page.url()).pathname.split('/').at(-1)! };
	const pending = await request.post('/api/v1/billing/topup/reconcile', { headers, data: payment });
	expect(pending.ok()).toBe(true);
	expect(await pending.json()).toMatchObject({ credited: false, provider_status: 'pending' });
	expect((await facts(request, account)).ledger).toEqual([]);
	await request.post('/_fixture/drain');
	const notices = async (): Promise<Mail[]> =>
		(await state(request, account.email)).mail.filter(
			(mail) => mail.subject === 'Баланс AIRIS пополнен'
		);
	expect(await notices()).toEqual([]);
	await page.getByRole('button', { name: 'Pay 500 RUB in local fixture' }).click();
	await expect(page.getByText('Top-up successful', { exact: true })).toBeVisible();
	expect((await billing(request, account, 'balance')).balance_topup_kopeks).toBe(50000);
	await expect
		.poll(async () => (await facts(request, account)).ledger)
		.toEqual([{ amount: 50000, reference: payment.payment_id }]);
	await expect(page.getByText('Top-up', { exact: true }).first()).toBeVisible();
	await page.getByRole('link', { name: 'Operations', exact: true }).click();
	await expect(
		page.getByRole('article', { name: /^Top-up,/ }).getByText('+RUB 500.00', { exact: true })
	).toBeVisible();
	await page
		.getByRole('link', { name: /^Back( to chat)?$/ })
		.first()
		.click();
	await expect(page).toHaveURL(chatURL);
	await expect(
		page.getByRole('log').getByText('AIRIS deterministic answer.', { exact: true })
	).toBeVisible();
	await request.post('/_fixture/drain');
	await expect.poll(notices).toHaveLength(1);
	const first = (await notices())[0];
	expect(first.reply_to).toBe('support@airis.you');
	expect(first.text).toContain('500');
	expect(first.message_id).toMatch(/^<.+>$/);
	for (let index = 0; index < 2; index++) {
		const replay = await request.post('/api/v1/billing/topup/reconcile', {
			headers,
			data: payment
		});
		expect(replay.ok()).toBe(true);
		expect(await replay.json()).toMatchObject({ credited: true });
		await request.post('/_fixture/drain');
	}
	expect((await facts(request, account)).ledger).toEqual([
		{ amount: 50000, reference: payment.payment_id }
	]);
	expect(await notices()).toEqual([first]);
	expect((await facts(request, account)).successes).toBe(1);
	expect((await state(request)).calls.length).toBe(providerBefore + 1);
});
